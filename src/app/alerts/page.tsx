'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import PageHeader from '@/components/common/PageHeader';
import AlertCard from '@/components/alerts/AlertCard';
import { useAlerts } from '@/components/alerts/useAlerts';
import { useI18n } from '@/i18n/I18nProvider';

type Filter = 'active' | 'all';

export default function AlertsPage() {
  const { dict } = useI18n();
  const { alerts, activeCount, loading, error } = useAlerts(50);
  const [filter, setFilter] = useState<Filter>('active');

  const shown = filter === 'active' ? alerts.filter((a) => a.isActive) : alerts;

  return (
    <>
      <PageHeader
        title={dict.nav.alerts}
        subtitle={dict.app.tagline}
        action={
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(_, v: Filter | null) => v && setFilter(v)}
          >
            <ToggleButton value="active">Active ({activeCount})</ToggleButton>
            <ToggleButton value="all">All</ToggleButton>
          </ToggleButtonGroup>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={130} sx={{ borderRadius: 3 }} />
          ))}
        </Stack>
      ) : shown.length === 0 ? (
        <Card>
          <CardContent>
            <Stack
              spacing={1}
              sx={{ alignItems: 'center', textAlign: 'center', py: 7, color: 'text.secondary' }}
            >
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {dict.dashboard.noAlerts}
              </Typography>
              <Typography variant="body2">{dict.dashboard.noAlertsHint}</Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {shown.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </Stack>
      )}

      {/* Thresholds are a design decision, not a published standard. Saying so
          on the page is both honest and the right framing for the thesis. */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
        Alerts are generated automatically from the PAGASA dam bulletin and Open-Meteo rainfall
        data. Thresholds are provisional, pending validation with the San Manuel MDRRMO.
      </Typography>
    </>
  );
}
