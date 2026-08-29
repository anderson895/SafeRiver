export type Trend = 'RISING' | 'FALLING' | 'STEADY';

/** Below this, movement is noise rather than a direction. */
const STEADY_BAND_M = 0.01;

/**
 * Rising, falling or steady over the last 24 hours.
 *
 * Pure and separate from the repository so it can be tested: the repository
 * imports `server-only`, which throws outside a server context.
 *
 * PAGASA publishes the 24-hour deviation itself, and that same figure is what
 * the UI prints beside this label — so it is what decides the label.
 *
 * Diffing against the previously stored reading answers a different question,
 * "since we last looked", and silently stretches to whatever gap the poller
 * left behind. During an eight-day cron outage that comparison spanned eight
 * days: San Roque was labelled FALLING directly beside a published +0.50 m, so
 * the arrow contradicted the number next to it — and pointed away from a
 * rising reservoir, which is the direction that matters.
 *
 * The stored comparison survives only as a fallback for when the bulletin
 * publishes no deviation.
 */
export function classifyTrend(
  deviation24h: number | null,
  current: number | null,
  previous: number | null,
): Trend {
  const delta =
    deviation24h ?? (current != null && previous != null ? current - previous : null);

  if (delta == null) return 'STEADY';
  if (Math.abs(delta) < STEADY_BAND_M) return 'STEADY';
  return delta > 0 ? 'RISING' : 'FALLING';
}
