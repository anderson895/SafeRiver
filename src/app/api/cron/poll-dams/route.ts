import { cronGuard } from '@/lib/auth/verifyCron';
import { fetchPagasaFlood, DamReadingSchema } from '@/lib/scrape/pagasaDams';
import { AGNO_DAM_IDS, getDam } from '@/lib/scrape/damRegistry';
import {
  persistReading,
  recordScrapeHealth,
  bumpScrapeFailureCount,
} from '@/lib/firebase/damRepository';
import { evaluateReservoirLevel, evaluateRelease, type DamRuleInput } from '@/lib/alerts/rules';
import { processSignals } from '@/lib/alerts/alertRepository';
import type { Signal } from '@/lib/alerts/types';

// cheerio + firebase-admin are Node-only; they cannot run on the Edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Scheduled scrape of the PAGASA dam bulletin.
 *
 * Triggered every ~30 min by GitHub Actions (Vercel's Hobby plan caps cron at
 * once per day, which is far too coarse for an alert system). A once-daily
 * Vercel cron is kept as a redundant backup trigger.
 *
 * FAIL-CLOSED CONTRACT: if the page cannot be fetched or parsed, we record the
 * failure and return non-OK *without touching stored state*. Stale-but-true
 * data is safe; fabricated or partially-parsed data is not. Specifically, a
 * missing outflow must never be persisted as 0 — that reads downstream as
 * "the dam is not releasing" and would silently suppress alerts.
 */
export async function POST(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;

  const startedAt = new Date();

  try {
    const result = await fetchPagasaFlood(startedAt);

    if (result.readings.length === 0) {
      throw new Error('Parsed 0 dams — page structure likely changed');
    }

    // Every reading must satisfy the schema before anything is written.
    // Validate the whole batch first so we never half-persist a bad scrape.
    for (const reading of result.readings) {
      const parsed = DamReadingSchema.safeParse(reading);
      if (!parsed.success) {
        throw new Error(
          `Schema validation failed for ${reading.damName}: ${parsed.error.issues
            .map((i) => `${i.path.join('.')} ${i.message}`)
            .join('; ')}`,
        );
      }
    }

    // The Agno cascade is the whole point of the system. If those three are
    // missing, treat it as a failed scrape even if other dams parsed.
    const missingAgno = AGNO_DAM_IDS.filter(
      (id) => !result.readings.some((r) => r.damId === id),
    );
    if (missingAgno.length > 0) {
      throw new Error(`Missing Agno dam(s): ${missingAgno.join(', ')}`);
    }

    const persisted = await Promise.all(result.readings.map(persistReading));
    const newObservations = persisted.filter((p) => p.isNewObservation).length;

    // ---- Alert evaluation ------------------------------------------------
    // Only the Agno cascade drives alerts for San Manuel; the other six dams
    // are stored for completeness but are on unrelated river systems.
    const signals: Signal[] = [];
    const consideredKeys: string[] = [];

    for (const reading of result.readings) {
      if (!AGNO_DAM_IDS.includes(reading.damId)) continue;
      const meta = getDam(reading.damId);

      const input: DamRuleInput = {
        damId: reading.damId,
        damName: reading.damName,
        isAgno: true,
        // San Roque is the downstream dam that discharges into San Manuel.
        isDownstream: reading.damId === 'san-roque',
        rwl: reading.rwl,
        nhwl: reading.nhwl ?? meta.nhwl ?? null,
        rwlDeviation24h: reading.rwlDeviation24h,
        gatesOpen: reading.gatesOpen,
        outflowCms: reading.outflowCms,
        observedAt: reading.observedAt.toISOString(),
      };

      // Every key is registered as "considered" even when no signal fires, so
      // a condition that stops can still reach its all-clear.
      consideredKeys.push(`DAM_RELEASE:${reading.damId}:outflow`);
      consideredKeys.push(`WATER_LEVEL:${reading.damId}:rwl`);
      consideredKeys.push(`WATER_LEVEL:${reading.damId}:rwlDeviation24h`);

      const level = evaluateReservoirLevel(input);
      if (level) signals.push(level);
      const release = evaluateRelease(input);
      if (release) signals.push(release);
    }

    const alerts = await processSignals(signals, consideredKeys, startedAt);

    await recordScrapeHealth({
      ok: true,
      at: startedAt,
      damsParsed: result.readings.length,
      newObservations,
    });
    await bumpScrapeFailureCount(true);

    return Response.json({
      ok: true,
      damsParsed: result.readings.length,
      newObservations,
      agnoBasin: result.agnoBasin?.status ?? null,
      agnoSubBasin: result.agnoSubBasin?.status ?? null,
      dams: persisted.map((p) => ({ damId: p.damId, trend: p.trend, isNew: p.isNewObservation })),
      alerts: {
        signalsRaised: signals.length,
        fired: alerts.fired,
        suppressed: alerts.suppressed.length,
      },
      durationMs: Date.now() - startedAt.getTime(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Record the failure, but leave damLatest untouched so the UI keeps showing
    // the last known-good reading (flagged stale) rather than nothing or garbage.
    await recordScrapeHealth({ ok: false, at: startedAt, error: message }).catch(() => {});
    const failures = await bumpScrapeFailureCount(false).catch(() => -1);

    console.error(`[poll-dams] FAILED (consecutive=${failures}): ${message}`);

    return Response.json(
      { ok: false, error: message, consecutiveFailures: failures },
      { status: 502 },
    );
  }
}

/** GET mirrors POST so the route can be smoke-tested from a browser or curl. */
export const GET = POST;
