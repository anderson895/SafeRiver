'use client';

import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import PageHeader from '@/components/common/PageHeader';
import StaleDataNotice from '@/components/common/StaleDataNotice';
import { StatBig, TrendIndicator, ThresholdRow } from '@/components/common/StatBig';
import WaterLevelTrendChart from '@/components/water/WaterLevelTrendChart';
import { useDams, useDamHistory } from '@/components/common/useDams';
import { useI18n } from '@/i18n/I18nProvider';

const HISTORY_DAYS = 14;

function formatPht(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export default function WaterLevelPage() {
  const { dict } = useI18n();
  const { agno, loading, error } = useDams();
  const [requestedId, setRequestedId] = useState<string | null>(null);

  // Selection is DERIVED, not synced with an effect: honour the user's choice
  // if it is still valid, otherwise fall back to San Roque (it sits in San
  // Manuel itself), then to whatever the scrape did return. This avoids a
  // setState-in-effect and removes the render where the dropdown shows a dam
  // that has no data behind it.
  const dam =
    agno.find((d) => d.damId === requestedId) ??
    agno.find((d) => d.damId === 'san-roque') ??
    agno[0] ??
    null;

  const damId = dam?.damId ?? '';
  const { points, loading: historyLoading } = useDamHistory(dam ? damId : null, HISTORY_DAYS);

  if (loading) {
    return (
      <>
        <PageHeader title={dict.water.title} subtitle={dict.app.tagline} />
        <Skeleton variant="rectangular" height={230} sx={{ borderRadius: 3, mb: 3 }} />
        <Skeleton variant="rectangular" height={340} sx={{ borderRadius: 3 }} />
      </>
    );
  }

  if (error || !dam) {
    return (
      <>
        <PageHeader title={dict.water.title} subtitle={dict.app.tagline} />
        <Alert severity="error">{error ?? dict.common.noData}</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title={dict.water.title} subtitle={dict.app.tagline} />
      <StaleDataNotice ageHours={dam.ageHours} />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 3 }}
          >
            <TextField
              select
              size="small"
              label={dict.water.selectStation}
              value={damId}
              onChange={(e) => setRequestedId(e.target.value)}
              sx={{ minWidth: 280 }}
            >
              {agno.map((d) => (
                <MenuItem key={d.damId} value={d.damId}>
                  {d.damName} — {d.location}
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="caption" color="text.secondary">
              {formatPht(dam.observedAt) ? `As of ${formatPht(dam.observedAt)}` : dict.common.noData}
            </Typography>
          </Stack>

          <Grid container spacing={3} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {dict.water.currentLevel}
              </Typography>
              <StatBig value={dam.rwl} unit="m" />
              <Box sx={{ mt: 1 }}>
                <TrendIndicator trend={dam.trend} delta={dam.rwlDeviation24h} />
              </Box>
              {dam.percentOfNhwl != null && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {dam.percentOfNhwl}% {dict.dam.ofNhwl}
                </Typography>
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <Stack
                direction="row"
                spacing={4}
                useFlexGap
                sx={{ flexWrap: 'wrap', justifyContent: { md: 'flex-end' } }}
              >
                <ThresholdRow
                  label={dict.water.normalLevel}
                  value={dam.thresholds.normal}
                  unit="m"
                  color="info.main"
                />
                <ThresholdRow
                  label={dict.water.alertLevel}
                  value={dam.thresholds.alert}
                  unit="m"
                  color="warning.main"
                />
                <ThresholdRow
                  label={dict.water.criticalLevel}
                  value={dam.thresholds.critical}
                  unit="m"
                  color="error.main"
                />
              </Stack>

              {/* The mockup implied a river gauge. No free public source
                  publishes river stage on the Agno at San Manuel, so be
                  explicit about what these numbers actually are rather than
                  letting them be misread as river depth. */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 2, display: 'block', textAlign: { md: 'right' } }}
              >
                Reservoir elevation in metres above sea level. Normal = rule curve elevation,
                Critical = spilling level (NHWL). Source: PAGASA dam bulletin.
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {dict.water.trendTitle} — Last {HISTORY_DAYS} days
              </Typography>
              {historyLoading ? (
                <Skeleton variant="rectangular" height={300} />
              ) : (
                <WaterLevelTrendChart points={points} thresholds={dam.thresholds} />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {dict.dam.currentRelease}
              </Typography>

              <StatBig
                value={dam.outflowCms}
                unit={dict.common.cms}
                color={dam.isReleasing ? 'error.main' : 'text.primary'}
                emptyText={dict.dam.notReleasing}
              />

              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Divider />
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    {dict.dam.gatesOpen}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {dam.gatesOpen ?? '—'}
                    {dam.gateOpeningM != null && ` (${dam.gateOpeningM} m)`}
                  </Typography>
                </Stack>
                <Divider />
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    size="small"
                    color={dam.isReleasing ? 'error' : 'success'}
                    variant={dam.isReleasing ? 'filled' : 'outlined'}
                    label={dam.isReleasing ? dict.dam.releasing : dict.dam.normalOperation}
                  />
                </Stack>
              </Stack>

              {/* A null outflow means "not published", which is not the same as
                  a confirmed zero. Saying so prevents the most dangerous
                  misreading this page could produce. */}
              {dam.outflowCms == null && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  PAGASA leaves this blank when no release is reported. Blank is not the same as a
                  confirmed zero.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
