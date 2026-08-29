import 'server-only';
import { db, COLLECTIONS, Timestamp } from '@/lib/firebase/admin';
import { decide, applyCompoundEscalation } from './evaluate';
import { compose } from './compose';
import { queueAlertEmail } from '@/lib/email/dispatcher';
import { emptyState, type AlertState, type Signal, type Severity } from './types';

/** Firestore document IDs cannot contain '/', which signal keys use ':' instead. */
function stateDocId(signalKey: string): string {
  return signalKey.replace(/[^\w:-]/g, '_');
}

function readState(raw: Record<string, unknown> | undefined, signalKey: string): AlertState {
  if (!raw) return emptyState(signalKey);
  const iso = (v: unknown) =>
    (v as { toDate?: () => Date } | null)?.toDate?.()?.toISOString() ?? null;
  return {
    signalKey,
    currentSeverity: (raw.currentSeverity as Severity) ?? 'NONE',
    lastValue: (raw.lastValue as number | null) ?? null,
    lastFiredAt: iso(raw.lastFiredAt),
    cooldownUntil: iso(raw.cooldownUntil),
    consecutiveBelowThreshold: (raw.consecutiveBelowThreshold as number) ?? 0,
    lastAlertId: (raw.lastAlertId as string | null) ?? null,
  };
}

export interface ProcessResult {
  fired: Array<{ alertId: string; signalKey: string; severity: Severity; reason: string }>;
  suppressed: Array<{ signalKey: string; reason: string }>;
}

/**
 * Runs every signal through the dedup state machine and persists the outcomes.
 *
 * `activeKeys` must list every signal key the current evaluation *considered*,
 * including those that produced no signal. Without it, a condition that stops
 * firing would never be evaluated again and its all-clear would never arrive —
 * the state would sit at WARNING forever.
 */
export async function processSignals(
  signals: Signal[],
  allConsideredKeys: string[],
  now: Date,
): Promise<ProcessResult> {
  const database = db();
  const escalated = applyCompoundEscalation(signals);
  const byKey = new Map(escalated.map((s) => [s.signalKey, s]));

  const keys = Array.from(new Set([...allConsideredKeys, ...byKey.keys()]));
  const stateRefs = keys.map((k) =>
    database.collection(COLLECTIONS.alertState).doc(stateDocId(k)),
  );
  const stateSnaps = keys.length ? await database.getAll(...stateRefs) : [];

  const result: ProcessResult = { fired: [], suppressed: [] };
  const batch = database.batch();

  // Decide first, with no I/O, so the set of firing keys is known before the
  // reads that supersession needs.
  const decisions = keys.map((key, i) => {
    const signal = byKey.get(key) ?? null;
    return {
      key,
      signal,
      decision: decide(signal, readState(stateSnaps[i]?.data(), key), now, key),
    };
  });

  /*
   * Alerts that a new fire replaces.
   *
   * Firing only ever appended a document and left the previous one active, so
   * a signal re-firing after its cooldown accumulated duplicates that the
   * dashboard then listed side by side — four simultaneous "Watch: Binga Dam
   * reservoir level" entries for one condition. Worse, an ALL_CLEAR wrote its
   * INFO notice without retiring the alert it was clearing, so "All Clear"
   * sat directly above the warning it had supposedly resolved.
   *
   * Two equality filters need no composite index — Firestore merges the
   * single-field ones — which keeps this project's index set empty. Verified
   * against the live project rather than assumed.
   */
  const superseded = new Map<string, string[]>();
  await Promise.all(
    decisions
      .filter((d) => d.decision.fire)
      .map(async ({ key }) => {
        const snap = await database
          .collection(COLLECTIONS.alerts)
          .where('signalKey', '==', key)
          .where('isActive', '==', true)
          .get();
        superseded.set(
          key,
          snap.docs.map((d) => d.id),
        );
      }),
  );

  decisions.forEach(({ key, signal, decision }) => {
    const next = decision.nextState;
    let alertId: string | null = null;

    if (decision.fire) {
      const alertRef = database.collection(COLLECTIONS.alerts).doc();
      alertId = alertRef.id;

      // Retire what this replaces, in the same batch, so there is never a
      // moment where two live alerts describe one condition. An ALL_CLEAR
      // retires its predecessors too — that is precisely its job.
      for (const oldId of superseded.get(key) ?? []) {
        batch.update(database.collection(COLLECTIONS.alerts).doc(oldId), {
          isActive: false,
          supersededBy: alertId,
          supersededAt: Timestamp.fromDate(now),
        });
      }

      // An all-clear has no live signal, so synthesise one for composition.
      const forCompose: Signal =
        signal ??
        ({
          signalKey: key,
          category: (key.split(':')[0] as Signal['category']) ?? 'GENERAL',
          severity: 'INFO',
          trigger: { metric: 'allClear', value: null, threshold: null, unit: '' },
        } satisfies Signal);

      const content = compose(forCompose, decision.severity);

      batch.set(alertRef, {
        signalKey: key,
        category: forCompose.category,
        severity: decision.severity,
        origin: 'AUTOMATED',
        reason: decision.reason,
        title: content.title,
        body: content.body,
        actionAdvice: content.actionAdvice,
        triggerData: forCompose.trigger,
        issuedAt: Timestamp.fromDate(now),
        isActive: decision.severity !== 'INFO',
        emailJobId: null,
        createdAt: Timestamp.now(),
      });

      result.fired.push({
        alertId,
        signalKey: key,
        severity: decision.severity,
        reason: decision.reason,
      });
    } else {
      result.suppressed.push({ signalKey: key, reason: decision.reason });
    }

    batch.set(database.collection(COLLECTIONS.alertState).doc(stateDocId(key)), {
      signalKey: key,
      currentSeverity: next.currentSeverity,
      lastValue: next.lastValue,
      lastFiredAt: next.lastFiredAt ? Timestamp.fromDate(new Date(next.lastFiredAt)) : null,
      cooldownUntil: next.cooldownUntil ? Timestamp.fromDate(new Date(next.cooldownUntil)) : null,
      consecutiveBelowThreshold: next.consecutiveBelowThreshold,
      lastAlertId: alertId ?? next.lastAlertId,
      updatedAt: Timestamp.now(),
    });
  });

  await batch.commit();

  // Queue fan-out only AFTER the alerts are durably written. Queueing inside
  // the batch would risk a job pointing at an alert that never got committed.
  for (const fired of result.fired) {
    try {
      await queueAlertEmail(fired.alertId, now);
    } catch (err) {
      // A queueing failure must not fail the whole scrape — the alert itself
      // is already saved and visible on the site.
      console.error(`[alerts] could not queue email for ${fired.alertId}: ${(err as Error).message}`);
    }
  }

  return result;
}

/** Recent alerts, newest first — powers the dashboard panel and alerts page. */
/**
 * How many alerts are active, across the whole collection.
 *
 * Not derivable from a page of recent alerts: the dashboard requests ten, so
 * counting within that page reported "9 active alerts" while nineteen were
 * live. A badge that silently saturates at the page size is worse than no
 * badge, because it looks like a count.
 *
 * A count aggregation, so the cost does not scale with the number of alerts.
 * Single equality filter, so no composite index.
 */
export async function countActiveAlerts(): Promise<number> {
  const snap = await db()
    .collection(COLLECTIONS.alerts)
    .where('isActive', '==', true)
    .count()
    .get();
  return snap.data().count;
}

export async function getRecentAlerts(limit = 20) {
  const snap = await db()
    .collection(COLLECTIONS.alerts)
    .orderBy('issuedAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      signalKey: data.signalKey as string,
      category: data.category as string,
      severity: data.severity as Severity,
      origin: data.origin as string,
      title: data.title as { en: string; tl: string },
      body: data.body as { en: string; tl: string },
      actionAdvice: data.actionAdvice as { en: string; tl: string },
      triggerData: data.triggerData ?? null,
      issuedAt: data.issuedAt?.toDate?.()?.toISOString() ?? null,
      isActive: Boolean(data.isActive),
    };
  });
}
