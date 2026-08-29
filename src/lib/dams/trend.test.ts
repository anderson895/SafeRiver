import { describe, expect, it } from 'vitest';
import { classifyTrend } from './trend';

describe('classifyTrend', () => {
  it('follows the published 24-hour deviation', () => {
    expect(classifyTrend(0.5, 274.14, 275.44)).toBe('RISING');
    expect(classifyTrend(-0.46, 751.18, 751.64)).toBe('FALLING');
  });

  it('prefers the published deviation over the stored comparison', () => {
    // The exact San Roque case from 29 August 2026. The previous stored
    // reading was eight days old because the poller had stopped, so a naive
    // diff said FALLING while PAGASA published +0.50 m for the last 24 hours.
    // The label sat directly beside that figure and contradicted it.
    expect(classifyTrend(0.5, 274.14, 275.44)).toBe('RISING');
  });

  it('falls back to the stored comparison when no deviation is published', () => {
    expect(classifyTrend(null, 274.5, 274.0)).toBe('RISING');
    expect(classifyTrend(null, 274.0, 274.5)).toBe('FALLING');
  });

  it('treats movement below one centimetre as steady', () => {
    expect(classifyTrend(0.005, null, null)).toBe('STEADY');
    expect(classifyTrend(-0.009, null, null)).toBe('STEADY');
    expect(classifyTrend(null, 274.005, 274.0)).toBe('STEADY');
  });

  it('reports STEADY rather than guessing when nothing is known', () => {
    expect(classifyTrend(null, null, null)).toBe('STEADY');
    expect(classifyTrend(null, 274.14, null)).toBe('STEADY');
    expect(classifyTrend(null, null, 274.14)).toBe('STEADY');
  });

  it('honours a published zero as steady, not as missing', () => {
    // 0 is a real reading: the reservoir held level. It must not fall through
    // to the stored comparison, which could report a direction the bulletin
    // explicitly contradicts.
    expect(classifyTrend(0, 274.14, 270.0)).toBe('STEADY');
  });
});
