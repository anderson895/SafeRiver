import type { Severity, Signal, TriggerData } from './types';
import type { DamId } from '@/lib/scrape/damRegistry';

/**
 * Alert thresholds.
 *
 * Every number here is provisional until validated with the San Manuel MDRRMO.
 * They are kept in one place (and mirrored into Firestore at config/thresholds)
 * so they can be retuned without a redeploy — and so the thesis can present a
 * single table of the operating rules.
 */
export interface Thresholds {
  dam: {
    /** Reservoir level thresholds expressed as OFFSETS from each dam's NHWL. */
    rwlOffsets: { advisory: number; watch: number; warning: number; critical: number };
    /** 24-hour rise in metres. */
    rise24h: { advisory: number; watch: number };
    /** Outflow in cubic metres per second, for San Roque. */
    outflowCms: { advisory: number; watch: number; warning: number; critical: number };
    /**
     * Upstream dams (Ambuklao, Binga) are smaller, so the same absolute
     * discharge means something different. Their outflow thresholds are scaled
     * — they act as a leading indicator rather than a direct flood driver.
     */
    upstreamOutflowScale: number;
  };
  rainfall: {
    /** PAGASA's published rainfall warning scale, mm/hr. */
    yellow: number;
    orange: number;
    red: number;
    /** 24-hour accumulation, mm. */
    accum24hWatch: number;
    accum24hWarning: number;
  };
  /** Hours before the same severity may re-notify. */
  cooldownHours: Record<Exclude<Severity, 'NONE' | 'INFO'>, number>;
  /** Value must fall below threshold * (1 - hysteresis) to count as clearing. */
  hysteresis: number;
  /** Consecutive clear evaluations required before an all-clear fires. */
  requiredConsecutiveClear: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  dam: {
    // For San Roque (NHWL 280): advisory 275, watch 278, warning 280, critical 280.5
    rwlOffsets: { advisory: -5, watch: -2, warning: 0, critical: 0.5 },
    rise24h: { advisory: 2.0, watch: 4.0 },
    outflowCms: { advisory: 500, watch: 1000, warning: 2500, critical: 5000 },
    upstreamOutflowScale: 0.6,
  },
  rainfall: {
    yellow: 7.5,
    orange: 15,
    red: 30,
    accum24hWatch: 100,
    accum24hWarning: 200,
  },
  cooldownHours: { ADVISORY: 12, WATCH: 6, WARNING: 3, CRITICAL: 1 },
  hysteresis: 0.1,
  requiredConsecutiveClear: 2,
};

export interface DamRuleInput {
  damId: DamId;
  damName: string;
  isAgno: boolean;
  /** Position in the cascade; San Roque is the downstream one that floods San Manuel. */
  isDownstream: boolean;
  rwl: number | null;
  nhwl: number | null;
  rwlDeviation24h: number | null;
  gatesOpen: number | null;
  outflowCms: number | null;
  observedAt: string | null;
}

/** Picks the highest severity whose condition holds. */
function ladder(
  value: number | null,
  steps: Array<[number, Severity]>,
): { severity: Severity; threshold: number | null } {
  // A null value means "not published". It must NEVER be treated as 0, which
  // would read as "safe" and silently suppress alerting.
  if (value == null) return { severity: 'NONE', threshold: null };

  let result: { severity: Severity; threshold: number | null } = {
    severity: 'NONE',
    threshold: null,
  };
  for (const [limit, severity] of steps) {
    if (value >= limit) result = { severity, threshold: limit };
  }
  return result;
}

/** Reservoir level relative to the dam's own spilling level. */
export function evaluateReservoirLevel(
  dam: DamRuleInput,
  t: Thresholds = DEFAULT_THRESHOLDS,
): Signal | null {
  if (dam.nhwl == null || dam.rwl == null) return null;

  const { rwlOffsets, rise24h } = t.dam;
  const byLevel = ladder(dam.rwl, [
    [dam.nhwl + rwlOffsets.advisory, 'ADVISORY'],
    [dam.nhwl + rwlOffsets.watch, 'WATCH'],
    [dam.nhwl + rwlOffsets.warning, 'WARNING'],
    [dam.nhwl + rwlOffsets.critical, 'CRITICAL'],
  ]);

  // A fast rise matters even from a low level — it is the leading edge of the
  // event, and the reason a purely level-based rule reacts too late.
  const byRise = ladder(dam.rwlDeviation24h, [
    [rise24h.advisory, 'ADVISORY'],
    [rise24h.watch, 'WATCH'],
  ]);

  const useRise = SEVERITY_ORDER(byRise.severity) > SEVERITY_ORDER(byLevel.severity);
  const chosen = useRise ? byRise : byLevel;
  if (chosen.severity === 'NONE') return null;

  const trigger: TriggerData = useRise
    ? {
        metric: 'rwlDeviation24h',
        value: dam.rwlDeviation24h,
        threshold: chosen.threshold,
        unit: 'm/24h',
        damId: dam.damId,
        damName: dam.damName,
        observedAt: dam.observedAt ?? undefined,
      }
    : {
        metric: 'rwl',
        value: dam.rwl,
        threshold: chosen.threshold,
        unit: 'masl',
        damId: dam.damId,
        damName: dam.damName,
        observedAt: dam.observedAt ?? undefined,
        // Carry the true spilling level so alert copy quotes it rather than
        // the (lower) bound that triggered this particular severity.
        nhwl: dam.nhwl,
      };

  return {
    signalKey: `WATER_LEVEL:${dam.damId}:${trigger.metric}`,
    category: 'WATER_LEVEL',
    severity: chosen.severity,
    trigger,
  };
}

/** Gate releases — the variable that actually floods San Manuel. */
export function evaluateRelease(
  dam: DamRuleInput,
  t: Thresholds = DEFAULT_THRESHOLDS,
): Signal | null {
  const scale = dam.isDownstream ? 1 : t.dam.upstreamOutflowScale;
  const { outflowCms } = t.dam;

  const byOutflow = ladder(dam.outflowCms, [
    [outflowCms.advisory * scale, 'ADVISORY'],
    [outflowCms.watch * scale, 'WATCH'],
    [outflowCms.warning * scale, 'WARNING'],
    [outflowCms.critical * scale, 'CRITICAL'],
  ]);

  // Any open gate is worth an advisory even below the discharge threshold:
  // downstream residents care that water is being released at all.
  const gatesOpen = dam.gatesOpen != null && dam.gatesOpen > 0;
  const severity: Severity =
    byOutflow.severity !== 'NONE' ? byOutflow.severity : gatesOpen ? 'ADVISORY' : 'NONE';

  if (severity === 'NONE') return null;

  return {
    signalKey: `DAM_RELEASE:${dam.damId}:outflow`,
    category: 'DAM_RELEASE',
    severity,
    trigger: {
      metric: 'outflowCms',
      value: dam.outflowCms,
      threshold: byOutflow.threshold,
      unit: 'CMS',
      damId: dam.damId,
      damName: dam.damName,
      observedAt: dam.observedAt ?? undefined,
    },
  };
}

export interface RainfallRuleInput {
  currentMmHr: number | null;
  maxNext3hMm: number | null;
  next24hTotalMm: number | null;
  observedAt?: string;
}

/** PAGASA's colour-coded rainfall warning scale. */
export function evaluateRainfall(
  input: RainfallRuleInput,
  t: Thresholds = DEFAULT_THRESHOLDS,
): Signal | null {
  const { yellow, orange, red, accum24hWatch, accum24hWarning } = t.rainfall;

  // Evaluate observed intensity and the forward-looking 3-hour peak, and take
  // whichever is worse — but record which one it was, so the email can say
  // "observed" or "forecast" rather than blurring them.
  const observed = ladder(input.currentMmHr, [
    [yellow, 'ADVISORY'],
    [orange, 'WATCH'],
    [red, 'WARNING'],
  ]);
  const forecast = ladder(input.maxNext3hMm, [
    [yellow, 'ADVISORY'],
    [orange, 'WATCH'],
    [red, 'WARNING'],
  ]);
  const accum = ladder(input.next24hTotalMm, [
    [accum24hWatch, 'WATCH'],
    [accum24hWarning, 'WARNING'],
  ]);

  const candidates: Array<{ s: typeof observed; metric: string; value: number | null; unit: string }> = [
    { s: observed, metric: 'rainfallObservedMmHr', value: input.currentMmHr, unit: 'mm/hr' },
    { s: forecast, metric: 'rainfallForecast3hMmHr', value: input.maxNext3hMm, unit: 'mm/hr' },
    { s: accum, metric: 'rainfall24hTotalMm', value: input.next24hTotalMm, unit: 'mm/24h' },
  ];

  const best = candidates.reduce((a, b) =>
    SEVERITY_ORDER(b.s.severity) > SEVERITY_ORDER(a.s.severity) ? b : a,
  );
  if (best.s.severity === 'NONE') return null;

  return {
    signalKey: `RAINFALL:sanmanuel:${best.metric}`,
    category: 'RAINFALL',
    severity: best.s.severity,
    trigger: {
      metric: best.metric,
      value: best.value,
      threshold: best.s.threshold,
      unit: best.unit,
      observedAt: input.observedAt,
    },
  };
}

/** Local import to avoid a cycle with types.ts's SEVERITY_RANK export. */
function SEVERITY_ORDER(s: Severity): number {
  return { NONE: 0, INFO: 1, ADVISORY: 2, WATCH: 3, WARNING: 4, CRITICAL: 5 }[s];
}
