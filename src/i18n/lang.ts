/**
 * Server-safe language helpers.
 *
 * Deliberately NOT in I18nProvider.tsx: that file carries `'use client'`,
 * which marks every one of its exports as client-only. A Server Component
 * importing `normalizeLang` from there fails at runtime with
 * "Attempted to call normalizeLang() from the server but normalizeLang is on
 * the client". These helpers are pure and must be callable from both sides.
 */
export type Lang = 'en' | 'tl';

export const LANG_COOKIE = 'lang';

/** Narrows an arbitrary cookie value to a supported language. */
export function normalizeLang(value: string | undefined): Lang {
  return value === 'tl' ? 'tl' : 'en';
}

/** `<html lang>` value. Filipino is `fil` in BCP-47; `tl` is the legacy tag. */
export function htmlLang(lang: Lang): string {
  return lang === 'tl' ? 'fil' : 'en';
}

/**
 * Picks the right side of a bilingual `{en, tl}` field stored in Firestore.
 *
 * Falls back with `||` rather than `??` deliberately. Translation is optional
 * when an officer posts an advisory under pressure, and an untranslated field
 * arrives as an empty string, not as undefined — which `??` would happily
 * return, showing a Tagalog reader a blank warning. Empty must count as
 * missing here.
 */
export function pick(field: { en?: string; tl?: string } | null | undefined, lang: Lang): string {
  if (!field) return '';
  const preferred = lang === 'tl' ? field.tl : field.en;
  if (preferred && preferred.trim()) return preferred;
  return field.en ?? '';
}
