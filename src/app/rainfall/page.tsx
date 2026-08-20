'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import PageHeader from '@/components/common/PageHeader';
import StaleDataNotice from '@/components/common/StaleDataNotice';
import { StatBig } from '@/components/common/StatBig';
import RainfallForecastChart, { type HourlyPoint } from '@/components/rainfall/RainfallForecastChart';
import IntensityScale from '@/components/rainfall/IntensityScale';
import type { RadarData } from '@/components/rainfall/RainfallMap';
import { useI18n } from '@/i18n/I18nProvider';
import { SEVERITY_COLORS } from '@/theme/theme';

const RainfallMap = dynamic(() => import('@/components/rainfall/RainfallMap'), {
  ssr: false,
  loading: () => <Skeleton variant="rectangular" height={460} sx={{ borderRadius: 3 }} />,
});

type IntensityClass = 'NONE' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'INTENSE' | 'TORRENTIAL';
type PagasaWarning = 'NONE' | 'YELLOW' | 'ORANGE' | 'RED';

interface RainfallData {
  fetchedAt: string | null;
  ageMinutes: number | null;
  current: { precipitationMmHr: number | null; temperature: number | null } | null;
  hourly: HourlyPoint[];
  daily: Array<{ date: string; precipitationSumMm: number | null }>;
  intensityClass: IntensityClass;
  pagasaWarning: PagasaWarning;
  maxNext3hMm: number | null;
  next24hTotalMm: number | null;
  riverDischargeCms: number | null;
  radar: RadarData | null;
}

const WARNING_COLOR: Record<PagasaWarning, string> = {
  NONE: '#9E9E9E',
  YELLOW: '#FBC02D',
  ORANGE: SEVERITY_COLORS.WATCH,
  RED: SEVERITY_COLORS.CRITICAL,
};

export default function RainfallPage() {
  const { dict, lang } = useI18n();
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<RainfallData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/rainfall');
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setData(body as RainfallData);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setSettled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!settled) {
    return (
      <>
        <PageHeader title={dict.rainfall.title} subtitle={dict.app.tagline} />
        <Skeleton variant="rectangular" height={480} sx={{ borderRadius: 3 }} />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title={dict.rainfall.title} subtitle={dict.app.tagline} />
        <Alert severity="warning">{error ?? dict.common.noData}</Alert>
      </>
    );
  }

  const mmHr = data.current?.precipitationMmHr ?? null;
  const isTl = lang === 'tl';

  return (
    <>
      <PageHeader
        title={dict.rainfall.title}
        subtitle={dict.app.tagline}
        action={
          <Chip
            size="small"
            label={dict.warning[data.pagasaWarning]}
            sx={{
              fontWeight: 800,
              bgcolor: `${WARNING_COLOR[data.pagasaWarning]}1A`,
              color: WARNING_COLOR[data.pagasaWarning],
            }}
          />
        }
      />

      {/* Tighter threshold than the dam pages. PAGASA publishes its bulletin
          once a day, so dam data being hours old is normal; the rainfall feed
          refreshes hourly, so the same age means the poll has stopped. Showing
          "No rain" from six hours ago during a storm is the failure this
          system exists to prevent. */}
      <StaleDataNotice
        ageHours={data.ageMinutes != null ? data.ageMinutes / 60 : null}
        thresholdHours={3}
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Tabs value={tab} onChange={(_, v: number) => setTab(v)} sx={{ mb: 2 }}>
                <Tab label={dict.rainfall.mapTab} />
                <Tab label={dict.rainfall.dataTab} />
              </Tabs>

              {tab === 0 ? (
                <>
                  <RainfallMap radar={data.radar} />
                  {/* An empty radar layer means "no returns available", not
                      "no rain" — say so rather than letting a clear map be
                      read as an all-clear. */}
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                    {isTl
                      ? 'Radar mula sa RainViewer. Kung walang kulay, maaaring walang available na radar — hindi ibig sabihing walang ulan. Ang forecast sa gilid ang batayan ng mga babala.'
                      : 'Radar imagery from RainViewer. An empty radar does not confirm "no rain" — it may simply mean no returns are available. The forecast figures alongside are what drive the alerts.'}
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                    {dict.rainfall.forecast} — {dict.rainfall.next24h}
                  </Typography>
                  <RainfallForecastChart hourly={data.hourly} hours={24} />
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {dict.rainfall.current}
                </Typography>
                <StatBig value={mmHr} unit={dict.common.mmPerHour} />
                <Typography variant="subtitle2" sx={{ mt: 0.5, fontWeight: 700 }}>
                  {dict.intensity[data.intensityClass]}
                </Typography>

                <Stack spacing={1.25} sx={{ mt: 2.5 }}>
                  <Divider />
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      {isTl ? 'Pinakamalakas sa 3 oras' : 'Peak next 3 hours'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {data.maxNext3hMm != null ? `${data.maxNext3hMm} mm/hr` : '—'}
                    </Typography>
                  </Stack>
                  <Divider />
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      {dict.rainfall.total24h}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {data.next24hTotalMm != null ? `${data.next24hTotalMm} mm` : '—'}
                    </Typography>
                  </Stack>
                </Stack>

                {data.ageMinutes != null && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                    {dict.common.lastUpdated.replace(
                      '{time}',
                      isTl ? `${data.ageMinutes} minuto ang nakalipas` : `${data.ageMinutes} min ago`,
                    )}
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* The only genuine *river* signal available for the Agno. PAGASA
                publishes reservoir levels, not river stage at the municipality. */}
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {dict.water.riverCondition}
                </Typography>
                <StatBig value={data.riverDischargeCms} unit="m³/s" color="info.main" />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {isTl
                    ? 'Tinatayang daloy ng Ilog Agno mula sa GloFAS (Open-Meteo Flood API).'
                    : 'Modelled Agno River discharge from GloFAS (Open-Meteo Flood API).'}
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <IntensityScale activeMmHr={mmHr} />
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
        {dict.common.source}: Open-Meteo forecast and GloFAS flood model. Intensity bands follow
        PAGASA&apos;s rainfall warning scale. Radar imagery © RainViewer.
      </Typography>
    </>
  );
}
