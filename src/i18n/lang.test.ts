import { describe, expect, it } from 'vitest';
import { htmlLang, normalizeLang, pick } from './lang';

/**
 * Tagalog is optional on a manually posted advisory, so `pick` is the only
 * thing standing between an untranslated field and a Tagalog reader being
 * shown a blank flood warning. That failure is silent — the page renders, the
 * email sends, and the message is simply empty.
 */
describe('pick', () => {
  const both = { en: 'Water release', tl: 'Pagpapakawala ng tubig' };

  it('returns the requested language when present', () => {
    expect(pick(both, 'en')).toBe('Water release');
    expect(pick(both, 'tl')).toBe('Pagpapakawala ng tubig');
  });

  it('falls back to English when the translation is absent', () => {
    expect(pick({ en: 'Water release' }, 'tl')).toBe('Water release');
  });

  it('falls back when the translation is an empty string', () => {
    // How an untranslated field actually arrives from the admin form — not as
    // undefined. `??` would return '' here and show nothing.
    expect(pick({ en: 'Water release', tl: '' }, 'tl')).toBe('Water release');
  });

  it('falls back when the translation is only whitespace', () => {
    // Whitespace is truthy, so `||` alone would still yield a blank warning.
    expect(pick({ en: 'Water release', tl: '   ' }, 'tl')).toBe('Water release');
    expect(pick({ en: 'Water release', tl: '\n\t' }, 'tl')).toBe('Water release');
  });

  it('never returns undefined for a missing or empty field', () => {
    expect(pick(null, 'tl')).toBe('');
    expect(pick(undefined, 'en')).toBe('');
    expect(pick({}, 'tl')).toBe('');
  });
});

describe('normalizeLang', () => {
  it('accepts tl and defaults everything else to en', () => {
    expect(normalizeLang('tl')).toBe('tl');
    expect(normalizeLang('en')).toBe('en');
    expect(normalizeLang(undefined)).toBe('en');
    expect(normalizeLang('fr')).toBe('en');
  });
});

describe('htmlLang', () => {
  it('maps Tagalog to the BCP-47 tag screen readers expect', () => {
    expect(htmlLang('tl')).toBe('fil');
    expect(htmlLang('en')).toBe('en');
  });
});
