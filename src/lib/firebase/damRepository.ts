import 'server-only';
import { db, COLLECTIONS, Timestamp } from './admin';
import type { DamReading } from '@/lib/scrape/pagasaDams';
import type { DamId } from '@/lib/scrape/damRegistry';

export type Trend = 'RISING' | 'FALLING' | 'STEADY';

/** Philippine Standard Time — all bucketing must be local, not UTC. */
const PHT_MS = 8 * 60 * 60 * 1000;

/** `2026-08-20` in PHT. Used for daily rollup document IDs. */
export function phtDateKey(d: Date): string {
  return new Date(d.getTime() + PHT_MS).toISOString().slice(0, 10);
}

/** `2026-08-20T08:00` in PHT. */
export function phtMinuteKey(d: Date): string {
  return new Date(d.getTime() + PHT_MS).toISOString().slice(0, 16);
}

/**
 * Deterministic document ID derived from the *observation* time, not the scrape
 * time. PAGASA publishes once daily, so polling every 30 minutes re-reads the
 * same bulletin ~48 times. Keying on the observation makes each re-write
 * idempotent: it overwrites an identical document instead of accumulating 48
 * duplicates a day.
 */
export function readingDocId(damId: DamId, observedAt: Date): string {
  return `${phtMinuteKey(observedAt)}_${damId}`;
}

function classifyTrend(current: number | null, previous: number | null): Trend {
  if (current == null || previous == null) return 'STEADY';
  const delta = current - previous;
  if (Math.abs(delta) < 0.01) return 'STEADY';
  return delta > 0 ? 'RISING' : 'FALLING';
}

export interface PersistResult {
  damId: DamId;
  isNewObservation: boolean;
  trend: Trend;
}

/**
 * Writes one reading across the three views we keep:
 *   damReadings/{obsKey_damId}  immutable-ish log, idempotent per observation
 *   damLatest/{damId}           single hot document the read APIs serve
 *   damDaily/{damId}_{date}     pre-aggregated rollup for trend charts
 *
 * The rollup matters for quota: a 30-day chart is ONE read per day-bucket
 * instead of scanning every raw reading.
 */
export async function persistReading(reading: DamReading): Promise<PersistResult> {
  const database = db();
  const latestRef = database.collection(COLLECTIONS.damLatest).doc(reading.damId);
  const priorSnap = await latestRef.get();
  const prior = priorSnap.exists ? priorSnap.data() : undefined;

  const priorObservedAt: Date | undefined = prior?.observedAt?.toDate?.();
  const isNewObservation =
    !priorObservedAt || priorObservedAt.getTime() !== reading.observedAt.getTime();

  // Compare against the last *different* observation so the trend doesn't reset
  // to STEADY every time we re-scrape the same daily bulletin.
  const trend = isNewObservation
    ? classifyTrend(reading.rwl, prior?.rwl ?? null)
    : ((prior?.trend as Trend | undefined) ?? 'STEADY');

  const base = {
    damId: reading.damId,
    damName: reading.damName,
    observedAt: Timestamp.fromDate(reading.observedAt),
    rwl: reading.rwl,
    rwlDeviation24h: reading.rwlDeviation24h,
    deviationHours: reading.deviationHours,
    nhwl: reading.nhwl,
    deviationFromNhwl: reading.deviationFromNhwl,
    ruleCurve: reading.ruleCurve,
    deviationFromRuleCurve: reading.deviationFromRuleCurve,
    gatesOpen: reading.gatesOpen,
    gateOpeningM: reading.gateOpeningM,
    inflowCms: reading.inflowCms,
    outflowCms: reading.outflowCms,
  };

  const batch = database.batch();

  batch.set(
    database.collection(COLLECTIONS.damReadings).doc(readingDocId(reading.damId, reading.observedAt)),
    {
      ...base,
      scrapedAt: Timestamp.now(),
      // Keep the raw cells so a future parser change can re-derive fields
      // from history instead of losing it.
      rawRow: reading.rawRow,
    },
  );

  batch.set(latestRef, {
    ...base,
    trend,
    previousReading: isNewObservation && prior
      ? { rwl: prior.rwl ?? null, outflowCms: prior.outflowCms ?? null, observedAt: prior.observedAt ?? null }
      : (prior?.previousReading ?? null),
    updatedAt: Timestamp.now(),
  });

  const dateKey = phtDateKey(reading.observedAt);
  const dailyRef = database
    .collection(COLLECTIONS.damDaily)
    .doc(`${reading.damId}_${dateKey}`);
  batch.set(
    dailyRef,
    buildDailyRollup(reading, dateKey),
    { merge: true },
  );

  await batch.commit();
  return { damId: reading.damId, isNewObservation, trend };
}

function buildDailyRollup(reading: DamReading, dateKey: string) {
  // Only include min/max when we actually have a number — otherwise a null
  // would clobber a real value on merge.
  const rollup: Record<string, unknown> = {
    damId: reading.damId,
    damName: reading.damName,
    date: dateKey,
    updatedAt: Timestamp.now(),
  };
  if (reading.rwl != null) {
    rollup.rwlClose = reading.rwl;
    rollup.rwlLast = reading.rwl;
  }
  if (reading.outflowCms != null) {
    rollup.outflowClose = reading.outflowCms;
  }
  if (reading.gatesOpen != null) {
    rollup.gatesOpenClose = reading.gatesOpen;
  }
  if (reading.nhwl != null) rollup.nhwl = reading.nhwl;
  return rollup;
}

/** Latest reading per dam, for the read APIs. */
export async function getLatestReadings() {
  const snap = await db().collection(COLLECTIONS.damLatest).get();
  return snap.docs.map((d) => d.data());
}

/**
 * Daily rollups for one dam, oldest first — powers the trend charts.
 *
 * Fetches by explicit document ID rather than running a query. Because IDs are
 * deterministic (`{damId}_{YYYY-MM-DD}`), the exact set of documents for "the
 * last N days" is computable without asking Firestore to search.
 *
 * Three reasons this beats a query here:
 *  - No index. Every ordered variant of this query (`orderBy(date)`, or a
 *    descending `__name__` range — which is what `limitToLast` compiles to)
 *    demands a composite index that must be defined and deployed.
 *  - Bounded, predictable cost: exactly `days` reads, always.
 *  - Gaps are free. A day with no bulletin simply comes back missing, which is
 *    what a chart should show anyway — rather than silently shifting an older
 *    reading into today's slot.
 */
export async function getDamHistory(damId: DamId, days = 30) {
  const database = db();
  const today = new Date();

  const ids: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    ids.push(`${damId}_${phtDateKey(d)}`);
  }

  const refs = ids.map((id) => database.collection(COLLECTIONS.damDaily).doc(id));
  const snaps = await database.getAll(...refs);

  return snaps.filter((s) => s.exists).map((s) => s.data()!);
}

export interface ScrapeHealth {
  ok: boolean;
  at: Date;
  damsParsed?: number;
  newObservations?: number;
  error?: string;
}

/** Records scraper health so /admin can show staleness and failures. */
export async function recordScrapeHealth(health: ScrapeHealth) {
  await db()
    .collection(COLLECTIONS.config)
    .doc('systemHealth')
    .set(
      {
        lastDamScrape: {
          ok: health.ok,
          at: Timestamp.fromDate(health.at),
          damsParsed: health.damsParsed ?? null,
          newObservations: health.newObservations ?? null,
          error: health.error ?? null,
        },
      },
      { merge: true },
    );
}

/** Consecutive-failure counter, used to decide when to alert the admin. */
export async function bumpScrapeFailureCount(reset: boolean): Promise<number> {
  const ref = db().collection(COLLECTIONS.config).doc('systemHealth');
  if (reset) {
    await ref.set({ consecutiveScrapeFailures: 0 }, { merge: true });
    return 0;
  }
  const snap = await ref.get();
  const next = ((snap.get('consecutiveScrapeFailures') as number | undefined) ?? 0) + 1;
  await ref.set({ consecutiveScrapeFailures: next }, { merge: true });
  return next;
}
