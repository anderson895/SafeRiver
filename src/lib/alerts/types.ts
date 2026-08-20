import type { DamId } from '@/lib/scrape/damRegistry';

/**
 * Severity ladder. Ordering is meaningful — comparisons drive escalation,
 * so use SEVERITY_RANK rather than comparing the strings.
 */
export const SEVERITIES = ['NONE', 'INFO', 'ADVISORY', 'WATCH', 'WARNING', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_RANK: Record<Severity, number> = {
  NONE: 0,
  INFO: 1,
  ADVISORY: 2,
  WATCH: 3,
  WARNING: 4,
  CRITICAL: 5,
};

export type AlertCategory =
  | 'DAM_RELEASE'
  | 'WATER_LEVEL'
  | 'RAINFALL'
  | 'FLOOD'
  | 'GENERAL';

export type AlertOrigin = 'AUTOMATED' | 'MANUAL';

/** Immutable evidence for why an alert fired — shown in the UI and the email. */
export interface TriggerData {
  metric: string;
  value: number | null;
  /** The bound that was crossed. NOT necessarily a meaningful real-world level. */
  threshold: number | null;
  unit: string;
  damId?: DamId;
  damName?: string;
  observedAt?: string;
  /**
   * The dam's actual spilling level (NHWL).
   *
   * Kept separate from `threshold` on purpose. A WATCH fires at NHWL-2, so
   * using `threshold` as "the spilling level" in copy would tell a resident
   * that Binga spills at 573 m when it really spills at 575 m. Alert text must
   * cite the real level, not the bound that happened to trigger.
   */
  nhwl?: number | null;
}

/** One candidate alert produced by a rule, before dedup/cooldown is applied. */
export interface Signal {
  /** Stable identity for this stream of alerts, e.g. `DAM_RELEASE:san-roque:outflow`. */
  signalKey: string;
  category: AlertCategory;
  severity: Severity;
  trigger: TriggerData;
}

/** Persisted per-signal state that makes deduplication possible. */
export interface AlertState {
  signalKey: string;
  currentSeverity: Severity;
  lastValue: number | null;
  lastFiredAt: string | null;
  cooldownUntil: string | null;
  /** Consecutive evaluations below the clear threshold; drives all-clear. */
  consecutiveBelowThreshold: number;
  lastAlertId: string | null;
}

export type AlertDecision =
  | { fire: false; reason: string; nextState: AlertState }
  | {
      fire: true;
      reason: 'ESCALATION' | 'RENOTIFY' | 'ALL_CLEAR';
      severity: Severity;
      nextState: AlertState;
    };

export function emptyState(signalKey: string): AlertState {
  return {
    signalKey,
    currentSeverity: 'NONE',
    lastValue: null,
    lastFiredAt: null,
    cooldownUntil: null,
    consecutiveBelowThreshold: 0,
    lastAlertId: null,
  };
}

export function isAtLeast(a: Severity, b: Severity): boolean {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b];
}
