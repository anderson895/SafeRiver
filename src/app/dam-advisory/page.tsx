'use client';

import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import FiberManualRecord from '@mui/icons-material/FiberManualRecord';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import PageHeader from '@/components/common/PageHeader';
import StaleDataNotice from '@/components/common/StaleDataNotice';
import { StatBig, TrendIndicator } from '@/components/common/StatBig';
import ReleaseHistoryChart from '@/components/dam/ReleaseHistoryChart';
import { useDams, useDamHistory } from '@/components/common/useDams';
import { useI18n } from '@/i18n/I18nProvider';
import type { DamDto } from '@/types/dam';

const HISTORY_DAYS = 30;

function formatPht(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** Compact status card for one dam in the Agno cascade. */
function DamCard({
  dam,
  selected,
  onSelect,
}: {
  dam: DamDto;
  selected: boolean;
  onSelect: () => void;
}) {
  const { dict } = useI18n();

  // Fill relative to the spilling level, clamped so a dam above NHWL renders a
  // full bar rather than overflowing it.
  const fill = dam.percentOfNhwl != null ? Math.min(100, Math.max(0, dam.percentOfNhwl)) : 0;
  const nearCritical =
    dam.rwl != null && dam.thresholds.alert != null && dam.rwl >= dam.thresholds.alert;

  return (
    <Card
      onClick={onSelect}
      sx={{
        cursor: 'pointer',
        height: '100%',
        borderColor: selected ? 'primary.main' : undefined,
        borderWidth: selected ? 2 : 1,
        borderStyle: 'solid',
        transition: 'border-color 120ms',
      }}
    >
      <CardContent>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {dam.damName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {dam.location}
            </Typography>
          </Box>
          {/* Icon + text, never colour alone (WCAG 1.4.1). */}
          <Chip
            size="small"
            icon={dam.isReleasing ? <WarningAmberOutlined /> : <FiberManualRecord />}
            color={dam.isReleasing ? 'error' : 'success'}
            variant={dam.isReleasing ? 'filled' : 'outlined'}
            label={dam.isReleasing ? dict.dam.releasing : dict.dam.normalOperation}
          />
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1 }}>
          <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.1 }}>
            {dam.rwl ?? '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            / {dam.nhwl ?? '—'} m
          </Typography>
        </Stack>

        <LinearProgress
          variant="determinate"
          value={fill}
          color={nearCritical ? 'error' : 'primary'}
          sx={{ height: 6, borderRadius: 3, mb: 1 }}
        />

        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <TrendIndicator trend={dam.trend} />
          <Typography variant="caption" color="text.secondary">
            {dam.outflowCms != null ? `${dam.outflowCms} CMS` : dict.dam.notReleasing}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function DamAdvisoryPage() {
  const { dict } = useI18n();
  const { agno, loading, error } = useDams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected =
    agno.find((d) => d.damId === selectedId) ??
    agno.find((d) => d.damId === 'san-roque') ??
    agno[0] ??
    null;

  const { points, loading: historyLoading } = useDamHistory(selected?.damId ?? null, HISTORY_DAYS);

  function exportCsv() {
    if (!selected) return;
    const rows = [
      ['date', 'outflow_cms', 'gates_open', 'reservoir_level_masl'],
      ...points.map((p) => [p.date, p.outflowCms ?? '', p.gatesOpen ?? '', p.rwl ?? '']),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected.damId}-release-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <>
        <PageHeader title={dict.dam.title} subtitle={dict.app.tagline} />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[0, 1, 2].map((i) => (
            <Grid key={i} size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 3 }} />
      </>
    );
  }

  if (error || !selected) {
    return (
      <>
        <PageHeader title={dict.dam.title} subtitle={dict.app.tagline} />
        <Alert severity="error">{error ?? dict.common.noData}</Alert>
      </>
    );
  }

  const anyReleasing = agno.some((d) => d.isReleasing);

  return (
    <>
      <PageHeader
        title={dict.dam.title}
        subtitle="Agno River cascade — Ambuklao → Binga → San Roque"
      />
      <StaleDataNotice ageHours={selected.ageHours} />

      {anyReleasing && (
        <Alert severity="warning" sx={{ mb: 3 }} icon={<WarningAmberOutlined />}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Water is being released upstream on the Agno.
          </Typography>
          <Typography variant="caption">
            Releases from Ambuklao and Binga flow down into San Roque, which discharges into the
            Agno at San Manuel. Upstream releases are a leading indicator here.
          </Typography>
        </Alert>
      )}

      {/* Ordered upstream -> downstream, matching how the water actually moves. */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {agno.map((dam) => (
          <Grid key={dam.damId} size={{ xs: 12, md: 4 }}>
            <DamCard
              dam={dam}
              selected={dam.damId === selected.damId}
              onSelect={() => setSelectedId(dam.damId)}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                {selected.damName}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {dict.dam.currentRelease}
              </Typography>

              <StatBig
                value={selected.outflowCms}
                unit={dict.common.cms}
                color={selected.isReleasing ? 'error.main' : 'text.primary'}
                emptyText={dict.dam.notReleasing}
              />

              <Stack spacing={1.5} sx={{ mt: 2.5 }}>
                <Divider />
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    {dict.dam.gatesOpen}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {selected.gatesOpen ?? '—'}
                    {selected.gateOpeningM != null && ` (${selected.gateOpeningM} m)`}
                  </Typography>
                </Stack>
                <Divider />
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {dict.dam.trend}
                  </Typography>
                  <TrendIndicator trend={selected.trend} />
                </Stack>
                <Divider />
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    {dict.dam.lastUpdated}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatPht(selected.observedAt) ?? '—'}
                  </Typography>
                </Stack>
                <Divider />
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    {dict.water.criticalLevel}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {selected.thresholds.critical ?? '—'} m
                  </Typography>
                </Stack>
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 2.5, display: 'block' }}>
                {dict.common.source}: PAGASA dam bulletin, published daily at 08:00 PHT.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
              >
                <Typography variant="h6">
                  {dict.dam.releaseHistory} — Last {HISTORY_DAYS} days
                </Typography>
                <Button
                  size="small"
                  startIcon={<DownloadOutlined />}
                  onClick={exportCsv}
                  disabled={points.length === 0}
                >
                  CSV
                </Button>
              </Stack>

              {historyLoading ? (
                <Skeleton variant="rectangular" height={280} />
              ) : (
                <ReleaseHistoryChart points={points} />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
