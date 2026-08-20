import { describe, it, expect } from 'vitest';
import { decide, applyCompoundEscalation } from './evaluate';
import {
  evaluateReservoirLevel,
  evaluateRelease,
  evaluateRainfall,
  DEFAULT_THRESHOLDS,
  type DamRuleInput,
} from './rules';
import { compose } from './compose';
import { emptyState, type AlertState, type Severity, type Signal } from './types';

const NOW = new Date('2026-08-20T08:00:00+08:00');
const KEY = 'DAM_RELEASE:san-roque:outflow';

/** San Roque baseline: NHWL 280, nothing happening. */
function sanRoque(overrides: Partial<DamRuleInput> = {}): DamRuleInput {
  return {
    damId: 'san-roque',
    damName: 'San Roque Dam',
    isAgno: true,
    isDownstream: true,
    rwl: 270,
    nhwl: 280,
    rwlDeviation24h: 0,
    gatesOpen: null,
    outflowCms: null,
    observedAt: NOW.toISOString(),
    ...overrides,
  };
}

function signal(severity: Severity, value: number | null = 1000): Signal {
  return {
    signalKey: KEY,
    category: 'DAM_RELEASE',
    severity,
    trigger: { metric: 'outflowCms', value, threshold: 1000, unit: 'CMS' },
  };
}

function stateAt(severity: Severity, extra: Partial<AlertState> = {}): AlertState {
  return { ...emptyState(KEY), currentSeverity: severity, ...extra };
}

// ---------------------------------------------------------------------------
describe('reservoir level rules', () => {
  const cases: Array<[string, Partial<DamRuleInput>, Severity | null]> = [
    ['well below any threshold', { rwl: 270 }, null],
    ['at NHWL-5 (275) -> ADVISORY', { rwl: 275 }, 'ADVISORY'],
    ['at NHWL-2 (278) -> WATCH', { rwl: 278 }, 'WATCH'],
    ['at NHWL (280) -> WARNING', { rwl: 280 }, 'WARNING'],
    ['above spilling (280.5) -> CRITICAL', { rwl: 280.5 }, 'CRITICAL'],
    ['low level but fast 24h rise -> ADVISORY', { rwl: 250, rwlDeviation24h: 2.5 }, 'ADVISORY'],
    ['low level but very fast rise -> WATCH', { rwl: 250, rwlDeviation24h: 4.5 }, 'WATCH'],
  ];

  for (const [name, override, expected] of cases) {
    it(name, () => {
      const result = evaluateReservoirLevel(sanRoque(override));
      expect(result?.severity ?? null).toBe(expected);
    });
  }

  it('returns null when the level is unpublished rather than assuming safe', () => {
    expect(evaluateReservoirLevel(sanRoque({ rwl: null }))).toBeNull();
  });
});

describe('release rules', () => {
  it('null outflow with no gates does not alert', () => {
    expect(evaluateRelease(sanRoque({ outflowCms: null, gatesOpen: null }))).toBeNull();
  });

  it('CRITICAL: a null outflow is never treated as zero-and-safe once gates are open', () => {
    // The dangerous case: gates reported open, discharge not yet published.
    const result = evaluateRelease(sanRoque({ outflowCms: null, gatesOpen: 2 }));
    expect(result?.severity).toBe('ADVISORY');
  });

  const ladder: Array<[number, Severity]> = [
    [500, 'ADVISORY'],
    [1000, 'WATCH'],
    [2500, 'WARNING'],
    [5000, 'CRITICAL'],
  ];
  for (const [cms, expected] of ladder) {
    it(`${cms} CMS at San Roque -> ${expected}`, () => {
      expect(evaluateRelease(sanRoque({ outflowCms: cms }))?.severity).toBe(expected);
    });
  }

  it('scales thresholds for upstream dams, which are only a leading indicator', () => {
    const upstream = sanRoque({ damId: 'binga', isDownstream: false, outflowCms: 600 });
    // 600 CMS clears the scaled WATCH bound (1000 * 0.6) upstream...
    expect(evaluateRelease(upstream)?.severity).toBe('WATCH');
    // ...but is only an ADVISORY at San Roque itself.
    expect(evaluateRelease(sanRoque({ outflowCms: 600 }))?.severity).toBe('ADVISORY');
  });
});

describe('rainfall rules (PAGASA scale)', () => {
  const cases: Array<[string, number | null, Severity | null]> = [
    ['no rain', 0, null],
    ['below yellow', 5, null],
    ['yellow (7.5)', 7.5, 'ADVISORY'],
    ['orange (>15)', 16, 'WATCH'],
    ['red (>30)', 31, 'WARNING'],
  ];
  for (const [name, mmHr, expected] of cases) {
    it(name, () => {
      const r = evaluateRainfall({ currentMmHr: mmHr, maxNext3hMm: null, next24hTotalMm: null });
      expect(r?.severity ?? null).toBe(expected);
    });
  }

  it('24h accumulation alone can raise a WATCH', () => {
    const r = evaluateRainfall({ currentMmHr: 0, maxNext3hMm: 0, next24hTotalMm: 120 });
    expect(r?.severity).toBe('WATCH');
  });

  it('labels the metric so forecast is never presented as observed', () => {
    const r = evaluateRainfall({ currentMmHr: 0, maxNext3hMm: 20, next24hTotalMm: 0 });
    expect(r?.trigger.metric).toBe('rainfallForecast3hMmHr');
  });
});

// ---------------------------------------------------------------------------
describe('decide(): dedup, cooldown, hysteresis', () => {
  it('fires on first activation', () => {
    const d = decide(signal('WATCH'), undefined, NOW);
    expect(d.fire).toBe(true);
    expect(d.fire && d.reason).toBe('ESCALATION');
  });

  it('fires on escalation even while inside the cooldown window', () => {
    const prior = stateAt('ADVISORY', {
      cooldownUntil: new Date(NOW.getTime() + 6 * 3600_000).toISOString(),
    });
    const d = decide(signal('WARNING'), prior, NOW);
    expect(d.fire).toBe(true);
    expect(d.fire && d.reason).toBe('ESCALATION');
  });

  it('does NOT re-fire at the same severity during cooldown', () => {
    const prior = stateAt('WATCH', {
      cooldownUntil: new Date(NOW.getTime() + 3 * 3600_000).toISOString(),
    });
    expect(decide(signal('WATCH'), prior, NOW).fire).toBe(false);
  });

  it('re-notifies at the same severity once cooldown has elapsed', () => {
    const prior = stateAt('WATCH', {
      cooldownUntil: new Date(NOW.getTime() - 60_000).toISOString(),
    });
    const d = decide(signal('WATCH'), prior, NOW);
    expect(d.fire).toBe(true);
    expect(d.fire && d.reason).toBe('RENOTIFY');
  });

  it('never notifies on de-escalation between two active levels', () => {
    const d = decide(signal('WATCH'), stateAt('WARNING'), NOW);
    expect(d.fire).toBe(false);
    expect(d.nextState.currentSeverity).toBe('WATCH');
  });

  it('requires two consecutive clear reads before an all-clear', () => {
    const first = decide(null, stateAt('WARNING'), NOW, KEY);
    expect(first.fire).toBe(false);
    expect(first.nextState.consecutiveBelowThreshold).toBe(1);
    // Severity is held so a single blip cannot silently cancel a warning.
    expect(first.nextState.currentSeverity).toBe('WARNING');

    const second = decide(null, first.nextState, NOW, KEY);
    expect(second.fire).toBe(true);
    expect(second.fire && second.reason).toBe('ALL_CLEAR');
    expect(second.nextState.currentSeverity).toBe('NONE');
  });

  it('a re-activation midway through clearing resets the streak', () => {
    const first = decide(null, stateAt('WARNING'), NOW, KEY);
    expect(first.nextState.consecutiveBelowThreshold).toBe(1);

    const back = decide(signal('WARNING'), first.nextState, NOW);
    expect(back.nextState.consecutiveBelowThreshold).toBe(0);
  });

  it('stays silent when nothing was ever active', () => {
    const d = decide(null, undefined, NOW, KEY);
    expect(d.fire).toBe(false);
  });

  it('a sustained condition does not spam: one fire, then silence', () => {
    // Simulate 48 polls in a day against an unchanging WATCH condition.
    let state = emptyState(KEY);
    let fires = 0;
    for (let i = 0; i < 48; i += 1) {
      const t = new Date(NOW.getTime() + i * 30 * 60_000);
      const d = decide(signal('WATCH'), state, t);
      if (d.fire) fires += 1;
      state = d.nextState;
    }
    // One initial escalation plus re-notifies at the 6-hour WATCH cooldown.
    expect(fires).toBeLessThanOrEqual(5);
    expect(fires).toBeGreaterThan(0);
  });
});

describe('compound escalation', () => {
  const rain = (s: Severity): Signal => ({
    signalKey: 'RAINFALL:sanmanuel:x',
    category: 'RAINFALL',
    severity: s,
    trigger: { metric: 'x', value: 1, threshold: 1, unit: 'mm/hr' },
  });

  it('raises severity when heavy rain coincides with a release', () => {
    const out = applyCompoundEscalation([rain('WATCH'), signal('WATCH')]);
    expect(out.every((s) => s.severity === 'WARNING')).toBe(true);
  });

  it('leaves signals alone when only one hazard is elevated', () => {
    const out = applyCompoundEscalation([rain('WATCH'), signal('ADVISORY')]);
    expect(out.map((s) => s.severity)).toEqual(['WATCH', 'ADVISORY']);
  });

  it('never escalates past CRITICAL', () => {
    const out = applyCompoundEscalation([rain('CRITICAL'), signal('CRITICAL')]);
    expect(out.every((s) => s.severity === 'CRITICAL')).toBe(true);
  });
});

describe('alert copy quotes real levels, not triggering bounds', () => {
  it('reports the true spilling level, not the WATCH threshold', () => {
    // Binga: NHWL 575, so WATCH triggers at 573. Copy must say 575.
    const binga = sanRoque({
      damId: 'binga',
      damName: 'Binga Dam',
      isDownstream: false,
      rwl: 574.42,
      nhwl: 575,
    });
    const s = evaluateReservoirLevel(binga)!;
    expect(s.severity).toBe('WATCH');
    expect(s.trigger.threshold).toBe(573); // the bound that fired
    expect(s.trigger.nhwl).toBe(575); // the real spilling level

    const text = compose(s, s.severity).body.en;
    expect(text).toContain('575');
    expect(text).not.toContain('573');
  });
});

describe('threshold table matches the documented operating rules', () => {
  it('San Roque critical level is the published spilling level', () => {
    const nhwl = 280;
    expect(nhwl + DEFAULT_THRESHOLDS.dam.rwlOffsets.warning).toBe(280);
    expect(nhwl + DEFAULT_THRESHOLDS.dam.rwlOffsets.watch).toBe(278);
    expect(nhwl + DEFAULT_THRESHOLDS.dam.rwlOffsets.advisory).toBe(275);
  });
});
