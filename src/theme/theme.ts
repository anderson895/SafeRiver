'use client';

import { createTheme } from '@mui/material/styles';

/**
 * Palette is deliberately flood-domain: blue for water//information, and the
 * standard PAGASA-style warning ramp (yellow -> orange -> red) for severity.
 *
 * Accessibility note: severity is NEVER conveyed by colour alone anywhere in
 * the UI (WCAG 1.4.1). Every severity chip pairs its colour with both an icon
 * and a text label.
 */
export const SEVERITY_COLORS = {
  INFO: '#0288D1',
  ADVISORY: '#FBC02D',
  WATCH: '#F57C00',
  WARNING: '#E64A19',
  CRITICAL: '#D32F2F',
} as const;

/** Project NOAH hazard classes. `Var` 1|2|3 = Low|Medium|High. */
export const HAZARD_COLORS = {
  1: '#90CAF9',
  2: '#2196F3',
  3: '#0D47A1',
} as const;

/** Depth ranges published with the Project NOAH dataset. */
export const HAZARD_LABELS = {
  1: { en: 'Low (0–0.5 m)', tl: 'Mababa (0–0.5 m)' },
  2: { en: 'Medium (0.5–1.5 m)', tl: 'Katamtaman (0.5–1.5 m)' },
  3: { en: 'High (more than 1.5 m)', tl: 'Mataas (higit 1.5 m)' },
} as const;

export const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: '#1565C0' },
    error: { main: '#D32F2F' },
    warning: { main: '#F57C00' },
    success: { main: '#2E7D32' },
    info: { main: '#0288D1' },
    background: { default: '#F4F6F8', paper: '#FFFFFF' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'var(--font-geist-sans), system-ui, -apple-system, sans-serif',
    h1: { fontSize: '2rem', fontWeight: 700 },
    h2: { fontSize: '1.5rem', fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid rgba(0,0,0,0.08)' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
    },
  },
});
