'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import PageHeader from '@/components/common/PageHeader';
import AlertCard from '@/components/alerts/AlertCard';
import { useAlerts } from '@/components/alerts/useAlerts';
import { HAZARD_COLORS } from '@/theme/theme';
import { useI18n } from '@/i18n/I18nProvider';
import type { ReturnPeriod } from '@/components/map/HazardMap';

// MapLibre touches `window` at import time, so it must never be server-rendered.
const HazardMap = dynamic(() => import('@/components/map/HazardMap'), {
  ssr: false,
  loading: () => <Skeleton variant="rectangular" height={520} sx={{ borderRadius: 3 }} />,
});

export default function DashboardPage() {
  const { dict } = useI18n();
  const [returnPeriod, setReturnPeriod] = useState<ReturnPeriod>('100yr');
  const { alerts, activeCount, loading: alertsLoading } = useAlerts(10);

  const legend = [
    { v: 1 as const, label: dict.hazard.low },
    { v: 2 as const, label: dict.hazard.medium },
    { v: 3 as const, label: dict.hazard.high },
  ];

  return (
    <>
      <PageHeader title={dict.dashboard.mapTitle} subtitle={dict.app.tagline} />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ mb: 2, justifyContent: 'space-between', alignItems: { sm: 'center' } }}
              >
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={returnPeriod}
                  onChange={(_, v: ReturnPeriod | null) => v && setReturnPeriod(v)}
                  aria-label={dict.dashboard.returnPeriod}
                >
                  <ToggleButton value="5yr">5-year</ToggleButton>
                  <ToggleButton value="25yr">25-year</ToggleButton>
                  <ToggleButton value="100yr">100-year</ToggleButton>
                </ToggleButtonGroup>

                <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {legend.map(({ v, label }) => (
                    <Stack key={v} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 14,
                          height: 14,
                          borderRadius: 0.5,
                          bgcolor: HAZARD_COLORS[v],
                          border: '1px solid rgba(0,0,0,0.2)',
                        }}
                      />
                      <Typography variant="caption">{label}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>

              <HazardMap returnPeriod={returnPeriod} />

              {/* Absence of colour in the north means "not mapped", not "safe".
                  Stating this on the map itself is a correctness requirement,
                  not a nicety — see the data-gap note in the plan. */}
              <Alert severity="info" variant="outlined" sx={{ mt: 2, py: 0.5 }}>
                <Typography variant="caption">{dict.hazard.dataGapNotice}</Typography>
              </Alert>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                Flood hazard data © Project NOAH / UP NOAH Center, licensed under ODbL. Basemap ©
                OpenFreeMap, © OpenMapTiles, data from OpenStreetMap contributors.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
              >
                <Typography variant="h6">{dict.dashboard.latestAlerts}</Typography>
                {activeCount > 0 && (
                  <Chip
                    size="small"
                    color="error"
                    label={dict.a11y.alertCount.replace('{count}', String(activeCount))}
                  />
                )}
              </Stack>

              {alertsLoading ? (
                <Stack spacing={1.5}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} variant="rectangular" height={92} sx={{ borderRadius: 2 }} />
                  ))}
                </Stack>
              ) : alerts.length === 0 ? (
                <Stack
                  spacing={1}
                  sx={{ alignItems: 'center', textAlign: 'center', py: 6, color: 'text.secondary' }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {dict.dashboard.noAlerts}
                  </Typography>
                  <Typography variant="caption">{dict.dashboard.noAlertsHint}</Typography>
                </Stack>
              ) : (
                <Stack spacing={1.5}>
                  {alerts.slice(0, 5).map((a) => (
                    <AlertCard key={a.id} alert={a} compact />
                  ))}
                  <Button component={Link} href="/alerts" size="small" sx={{ alignSelf: 'flex-start' }}>
                    {dict.common.viewAll}
                  </Button>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
