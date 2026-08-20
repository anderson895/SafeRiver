'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import CampaignOutlined from '@mui/icons-material/CampaignOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { useI18n } from '@/i18n/I18nProvider';
import { pick } from '@/i18n/lang';
import { SEVERITY_COLORS } from '@/theme/theme';

export interface AlertItem {
  id: string;
  category: string;
  severity: 'INFO' | 'ADVISORY' | 'WATCH' | 'WARNING' | 'CRITICAL';
  origin: string;
  title: { en: string; tl: string };
  body: { en: string; tl: string };
  actionAdvice: { en: string; tl: string };
  triggerData?: { metric?: string; value?: number | null; unit?: string } | null;
  issuedAt: string | null;
  isActive: boolean;
}

/**
 * Every severity pairs a colour with BOTH an icon and a text label.
 * Colour alone would fail WCAG 1.4.1 — and would be unreadable for the
 * colour-blind users this system cannot afford to lose.
 */
const SEVERITY_ICON: Record<AlertItem['severity'], SvgIconComponent> = {
  INFO: InfoOutlined,
  ADVISORY: CampaignOutlined,
  WATCH: VisibilityOutlined,
  WARNING: WarningAmberOutlined,
  CRITICAL: ErrorOutlineOutlined,
};

function relativeTime(iso: string | null, lang: 'en' | 'tl'): string {
  if (!iso) return '';
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(lang === 'tl' ? 'fil' : 'en', { numeric: 'auto' });
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(-diffHr, 'hour');
  return rtf.format(-Math.round(diffHr / 24), 'day');
}

export default function AlertCard({ alert, compact = false }: { alert: AlertItem; compact?: boolean }) {
  const { dict, lang } = useI18n();
  const Icon = SEVERITY_ICON[alert.severity];
  const color = SEVERITY_COLORS[alert.severity];

  // Only the most severe card takes a filled treatment; if everything shouts,
  // nothing does.
  const filled = alert.severity === 'CRITICAL';

  return (
    <Card
      sx={{
        borderLeft: filled ? undefined : `4px solid ${color}`,
        bgcolor: filled ? color : undefined,
        color: filled ? '#fff' : undefined,
        opacity: alert.isActive ? 1 : 0.72,
      }}
    >
      <CardContent sx={{ py: compact ? 1.5 : 2, '&:last-child': { pb: compact ? 1.5 : 2 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
          <Icon sx={{ fontSize: 18, color: filled ? 'inherit' : color }} />
          <Chip
            size="small"
            label={dict.severity[alert.severity]}
            sx={{
              height: 20,
              fontSize: 11,
              fontWeight: 800,
              bgcolor: filled ? 'rgba(255,255,255,0.22)' : `${color}1A`,
              color: filled ? '#fff' : color,
            }}
          />
          {!alert.isActive && (
            <Chip size="small" variant="outlined" label="Resolved" sx={{ height: 20, fontSize: 11 }} />
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            {relativeTime(alert.issuedAt, lang)}
          </Typography>
        </Stack>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.35 }}>
          {pick(alert.title, lang)}
        </Typography>

        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.92 }}>
          {pick(alert.body, lang)}
        </Typography>

        {!compact && alert.actionAdvice && (
          <Typography
            variant="body2"
            sx={{
              mt: 1.25,
              p: 1.25,
              borderRadius: 1.5,
              fontWeight: 600,
              bgcolor: filled ? 'rgba(255,255,255,0.15)' : 'action.hover',
            }}
          >
            {pick(alert.actionAdvice, lang)}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
