'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';
import { useI18n } from '@/i18n/I18nProvider';

export function StatBig({
  value,
  unit,
  color = 'primary.main',
  emptyText,
}: {
  value: number | string | null;
  unit?: string;
  color?: string;
  emptyText?: string;
}) {
  const { dict } = useI18n();

  if (value == null || value === '') {
    return (
      <Typography variant="h5" color="text.disabled" sx={{ fontWeight: 600 }}>
        {emptyText ?? dict.common.noData}
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
      <Typography sx={{ fontSize: { xs: '2.25rem', md: '2.75rem' }, fontWeight: 800, lineHeight: 1.1, color }}>
        {value}
      </Typography>
      {unit && (
        <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {unit}
        </Typography>
      )}
    </Stack>
  );
}

export type TrendKind = 'RISING' | 'FALLING' | 'STEADY';

/**
 * Trend indicator.
 *
 * Pairs an arrow icon WITH a text label rather than relying on colour alone
 * (WCAG 1.4.1). Red-on-rising is meaningful here — a rising reservoir is the
 * dangerous direction — but colour is never the only carrier of that meaning.
 */
export function TrendIndicator({ trend, delta }: { trend: TrendKind; delta?: number | null }) {
  const { dict } = useI18n();

  const config = {
    RISING: { Icon: ArrowUpward, color: 'error.main', label: dict.water.rising },
    FALLING: { Icon: ArrowDownward, color: 'success.main', label: dict.water.falling },
    STEADY: { Icon: RemoveIcon, color: 'text.secondary', label: dict.water.steady },
  }[trend];

  const { Icon, color, label } = config;

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color }}>
      <Icon sx={{ fontSize: 18 }} />
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {label}
      </Typography>
      {delta != null && delta !== 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          ({delta > 0 ? '+' : ''}
          {delta.toFixed(2)} m / 24h)
        </Typography>
      )}
    </Stack>
  );
}

/** One Normal / Alert / Critical threshold cell. */
export function ThresholdRow({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | null;
  unit: string;
  color: string;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, color, fontSize: '1.1rem' }}>
        {value != null ? `${value} ${unit}` : '—'}
      </Typography>
    </Box>
  );
}
