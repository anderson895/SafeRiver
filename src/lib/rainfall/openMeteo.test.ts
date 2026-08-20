import { describe, it, expect } from 'vitest';
import { classifyIntensity, classifyPagasaWarning, RAINFALL_THRESHOLDS } from './openMeteo';

/**
 * These lock down a unit bug that silently disabled the observed-rainfall
 * alert path.
 *
 * Open-Meteo's `current.precipitation` is a backward-looking sum over its
 * `interval`, which is 900 seconds. It was being read as mm/hr and passed
 * straight to the PAGASA classifier, so every band required four times the
 * intended rainfall before firing — Yellow at 30 mm/hr instead of 7.5, Red at
 * 120 mm/hr instead of 30. 120 mm/hr is near-record rainfall, so in practice
 * the path never fired at all.
 *
 * The classifier is now fed `hourly.precipitation` for the current hour, which
 * Open-Meteo documents as the sum of the preceding hour.
 */
describe('PAGASA classification operates on mm per HOUR', () => {
  const cases: Array<[number, string]> = [
    [0, 'NONE'],
    [2, 'NONE'],
    [7.4, 'NONE'],
    [7.5, 'YELLOW'],
    [15, 'YELLOW'],
    [15.1, 'ORANGE'],
    [30, 'ORANGE'],
    [30.1, 'RED'],
  ];

  for (const [mmHr, expected] of cases) {
    it(`${mmHr} mm/hr -> ${expected}`, () => {
      expect(classifyPagasaWarning(mmHr)).toBe(expected);
    });
  }

  it('null means unknown, never "no warning by measurement"', () => {
    expect(classifyPagasaWarning(null)).toBe('NONE');
  });

  it('a 15-minute figure misread as hourly would under-report by one band or more', () => {
    // 8 mm falling in 15 minutes is 32 mm/hr — RED.
    const fifteenMinuteTotal = 8;
    const trueHourlyRate = fifteenMinuteTotal * 4;

    expect(classifyPagasaWarning(trueHourlyRate)).toBe('RED');
    // Passing the raw 15-minute figure instead yields YELLOW: two bands low.
    expect(classifyPagasaWarning(fifteenMinuteTotal)).toBe('YELLOW');
  });

  it('thresholds match the published PAGASA scale', () => {
    expect(RAINFALL_THRESHOLDS).toEqual({ yellow: 7.5, orange: 15, red: 30 });
  });
});

describe('intensity bands', () => {
  const cases: Array<[number | null, string]> = [
    [null, 'NONE'],
    [0, 'NONE'],
    [1, 'LIGHT'],
    [5, 'MODERATE'],
    [10, 'HEAVY'],
    [20, 'INTENSE'],
    [45, 'TORRENTIAL'],
  ];

  for (const [mmHr, expected] of cases) {
    it(`${mmHr} mm/hr -> ${expected}`, () => {
      expect(classifyIntensity(mmHr)).toBe(expected);
    });
  }
});
