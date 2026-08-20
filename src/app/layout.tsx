import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from '@/theme/theme';
import { I18nProvider } from '@/i18n/I18nProvider';
// Imported from lang.ts, not I18nProvider.tsx — that file is 'use client',
// so its exports cannot be called during server rendering.
import { LANG_COOKIE, htmlLang, normalizeLang } from '@/i18n/lang';
import AppShell from '@/components/layout/AppShell';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'San Manuel Flood Information System',
    template: '%s · San Manuel Flood Information System',
  },
  description:
    'Flood hazard maps, rainfall, and San Roque Dam release advisories for Agno River communities in San Manuel, Pangasinan.',
};

export const viewport: Viewport = {
  themeColor: '#1565C0',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Read the language on the SERVER so the first paint is already correct —
  // no flash of English, and <html lang> is right for screen readers on the
  // initial response. localStorage alone could not do this.
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);

  return (
    <html lang={htmlLang(lang)} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {/* Without AppRouterCacheProvider, MUI flashes unstyled content on
            every App Router navigation. */}
        <AppRouterCacheProvider options={{ key: 'mui' }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <I18nProvider initialLang={lang}>
              <AppShell>{children}</AppShell>
            </I18nProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
