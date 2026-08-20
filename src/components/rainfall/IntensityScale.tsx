'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * PAGASA's rainfall warning scale.
 *
 * Shown to the reader for two reasons: it explains what "Heavy" actually
 * means in millimetres, and it makes the alert thresholds legible — the same
 * numbers drive the rule engine, so a resident can see why an alert fired.
 */
const BANDS = [
  { key: 'NONE', color: '#E0E0E0', from: 0, to: 2.5 },
  { key: 'LIGHT', color: '#B3E5FC', from: 2.5, to: 7.5 },
  { key: 'YELLOW', color: '#FBC02D', from: 7.5, to: 15 },
  { key: 'ORANGE', color: '#F57C00', from: 15, to: 30 },
  { key: 'RED', color: '#D32F2F', from: 30, to: null },
] as const;

export default function IntensityScale({ activeMmHr }: { activeMmHr?: number | null }) {
  const { lang } = useI18n();
  const isTl = lang === 'tl';

  const LABELS: Record<string, { en: string; tl: string }> = {
    NONE: { en: 'None / Light', tl: 'Wala / Mahina' },
    LIGHT: { en: 'Moderate', tl: 'Katamtaman' },
    YELLOW: { en: 'Heavy — Yellow', tl: 'Malakas — Dilaw' },
    ORANGE: { en: 'Intense — Orange', tl: 'Napakalakas — Kahel' },
    RED: { en: 'Torrential — Red', tl: 'Sobrang lakas — Pula' },
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        {isTl ? 'Antas ng pag-ulan (PAGASA)' : 'Rainfall intensity (PAGASA scale)'}
      </Typography>

      <Stack spacing={0.75}>
        {BANDS.map((b) => {
          const active =
            activeMmHr != null &&
            activeMmHr >= b.from &&
            (b.to == null || activeMmHr < b.to);

          return (
            <Stack
              key={b.key}
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                bgcolor: active ? 'action.selected' : undefined,
              }}
            >
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: 0.5,
                  bgcolor: b.color,
                  border: '1px solid rgba(0,0,0,0.2)',
                  flexShrink: 0,
                }}
              />
              <Typography variant="caption" sx={{ flexGrow: 1, fontWeight: active ? 800 : 400 }}>
                {isTl ? LABELS[b.key].tl : LABELS[b.key].en}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {b.to == null ? `>${b.from}` : `${b.from}–${b.to}`} mm/hr
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
