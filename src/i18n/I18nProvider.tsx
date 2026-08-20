'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { en, type Dictionary } from './dictionaries/en';
import { tl } from './dictionaries/tl';
import { LANG_COOKIE, htmlLang, type Lang } from './lang';

const DICTIONARIES: Record<Lang, Dictionary> = { en, tl };

interface I18nValue {
  lang: Lang;
  dict: Dictionary;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    // Cookie (not just localStorage) so the SERVER can read the choice and
    // render the correct language on first paint — no flash of English, and
    // <html lang> is correct for screen readers on the very first response.
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = htmlLang(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, dict: DICTIONARIES[lang], setLang }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export type { Lang };
