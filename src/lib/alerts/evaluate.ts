import {
  SEVERITY_RANK,
  emptyState,
  type AlertDecision,
  type AlertState,
  type Severity,
  type Signal,
} from './types';
import { DEFAULT_THRESHOLDS, type Thresholds } from './rules';

/**
 * Decides whether a signal should actually notify anyone.
 *
 * This is the single most dangerous function in the system: everything above it
 * only reads data, while a mistake here sends real email to real residents —
 * or, worse, stays silent during a genuine release. It is deliberately pure
 * (no I/O, no clock of its own) so that every branch is unit-testable.
 *
 * The rules, in order:
 *
 *  1. ESCALATION — severity increased. Fire immediately, ignoring cooldown.
 *     Conditions worsening is always worth interrupting someone for.
 *
 *  2. RENOTIFY — same severity, cooldown elapsed. Fire again as a reminder.
 *
 *  3. ALL_CLEAR — the value has stayed below `threshold x (1 - hysteresis)`
 *     for `requiredConsecutiveClear` evaluations. Hysteresis stops a value
 *     hovering on the boundary from alternating alert/all-clear forever.
 *
 *  4. DE-ESCALATION between two non-zero levels (WARNING -> WATCH) is recorded
 *     silently and never notifies. This single rule removes most of the noise
 *     an naive implementation would generate.
 */
export function decide(
  signal: Signal | null,
  prior: AlertState | undefined,
  now: Date,
  signalKey?: string,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): AlertDecision {
  const key = signal?.signalKey ?? signalKey;
  if (!key) throw new Error('decide() needs either a signal or an explicit signalKey');

  const state: AlertState = prior ?? emptyState(key);
  const newSeverity: Severity = signal?.severity ?? 'NONE';
  const oldSeverity = state.currentSeverity;
  const nowIso = now.toISOString();

  // ---- No active condition: consider an all-clear -----------------------
  if (newSeverity === 'NONE') {
    if (SEVERITY_RANK[oldSeverity] <= SEVERITY_RANK.INFO) {
      // Nothing was active; stay quiet and keep the counter at rest.
      return {
        fire: false,
        reason: 'no active condition',
        nextState: { ...state, currentSeverity: 'NONE', consecutiveBelowThreshold: 0 },
      };
    }

    const cleared = state.consecutiveBelowThreshold + 1;
    if (cleared < thresholds.requiredConsecutiveClear) {
      return {
        fire: false,
        reason: `clearing (${cleared}/${thresholds.requiredConsecutiveClear})`,
        // Severity is held until the all-clear actually fires, so a single
        // blip cannot silently cancel an active warning.
        nextState: { ...state, consecutiveBelowThreshold: cleared },
      };
    }

    return {
      fire: true,
      reason: 'ALL_CLEAR',
      severity: 'INFO',
      nextState: {
        ...state,
        currentSeverity: 'NONE',
        lastValue: null,
        lastFiredAt: nowIso,
        cooldownUntil: null,
        consecutiveBelowThreshold: 0,
      },
    };
  }

  // ---- An active condition exists ---------------------------------------
  const value = signal!.trigger.value;
  const base: AlertState = {
    ...state,
    currentSeverity: newSeverity,
    lastValue: value,
    // Any active reading resets the clearing streak.
    consecutiveBelowThreshold: 0,
  };

  const cooldownFor = (s: Severity): number =>
    s === 'INFO' || s === 'NONE'
      ? 0
      : thresholds.cooldownHours[s as Exclude<Severity, 'NONE' | 'INFO'>];

  const withCooldown = (s: Severity): AlertState => ({
    ...base,
    lastFiredAt: nowIso,
    cooldownUntil: new Date(now.getTime() + cooldownFor(s) * 3_600_000).toISOString(),
  });

  if (SEVERITY_RANK[newSeverity] > SEVERITY_RANK[oldSeverity]) {
    return { fire: true, reason: 'ESCALATION', severity: newSeverity, nextState: withCooldown(newSeverity) };
  }

  if (SEVERITY_RANK[newSeverity] < SEVERITY_RANK[oldSeverity]) {
    // Improving, but still active. Record it; do not notify.
    return {
      fire: false,
      reason: `de-escalation ${oldSeverity} -> ${newSeverity} (silent)`,
      nextState: base,
    };
  }

  // Same severity — re-notify only once the cooldown has elapsed.
  const cooldownUntil = state.cooldownUntil ? new Date(state.cooldownUntil) : null;
  if (cooldownUntil && now < cooldownUntil) {
    return {
      fire: false,
      reason: `cooldown until ${state.cooldownUntil}`,
      nextState: base,
    };
  }

  return { fire: true, reason: 'RENOTIFY', severity: newSeverity, nextState: withCooldown(newSeverity) };
}

/**
 * Compound-hazard escalation.
 *
 * Saturated ground plus a dam release is the documented Agno flood mechanism:
 * either alone may be survivable, together they are not. Raising severity when
 * both are elevated is what makes this an alert *system* rather than two
 * independent threshold watchers, and it is the part worth defending in the
 * thesis.
 */
export function applyCompoundEscalation(signals: Signal[]): Signal[] {
  const worst = (category: Signal['category']) =>
    signals
      .filter((s) => s.category === category)
      .reduce<number>((max, s) => Math.max(max, SEVERITY_RANK[s.severity]), 0);

  const rain = worst('RAINFALL');
  const release = Math.max(worst('DAM_RELEASE'), worst('WATER_LEVEL'));

  if (rain < SEVERITY_RANK.WATCH || release < SEVERITY_RANK.WATCH) return signals;

  const bump = (s: Severity): Severity => {
    const next = Math.min(SEVERITY_RANK.CRITICAL, SEVERITY_RANK[s] + 1);
    return (Object.keys(SEVERITY_RANK) as Severity[]).find((k) => SEVERITY_RANK[k] === next) ?? s;
  };

  return signals.map((s) =>
    s.category === 'RAINFALL' || s.category === 'DAM_RELEASE' || s.category === 'WATER_LEVEL'
      ? { ...s, severity: bump(s.severity) }
      : s,
  );
}
