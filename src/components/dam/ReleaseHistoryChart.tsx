'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';
import type { DamHistoryPoint } from '@/types/dam';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Outflow over time.
 *
 * Days where PAGASA published no release are plotted as 0 rather than dropped,
 * because for *this* series a blank genuinely does mean "no release reported"
 * and a gap would misleadingly imply missing data. That is the opposite of how
 * the current-reading card treats null — there, blank must never be shown as
 * zero, since it would read as "confirmed not releasing".
 */
export default function ReleaseHistoryChart({
  points,
  height = 280,
}: {
  points: DamHistoryPoint[];
  height?: number;
}) {
  const { dict } = useI18n();

  if (points.length < 2) {
    return (
      <Stack
        spacing={1}
        sx={{ height, alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }} color="text.secondary">
          {dict.common.noData}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 380 }}>
          One reading is recorded per day. This chart fills in as the daily bulletin accumulates —
          currently {points.length} day(s).
        </Typography>
      </Stack>
    );
  }

  const values = points.map((p) => p.outflowCms ?? 0);

  return (
    <Box sx={{ width: '100%' }}>
      <LineChart
        height={height}
        series={[
          {
            data: values,
            label: dict.dam.currentRelease,
            color: '#D32F2F',
            area: true,
            showMark: points.length <= 20,
            curve: 'monotoneX',
            valueFormatter: (v) => (v == null ? '—' : `${v} CMS`),
          },
        ]}
        xAxis={[{ data: points.map((p) => p.date.slice(5)), scaleType: 'point' }]}
        yAxis={[{ min: 0, label: 'CMS' }]}
        margin={{ left: 12, right: 16, top: 20, bottom: 24 }}
        hideLegend
      />

      {/* SVG charts expose nothing to screen readers; the table is the
          accessible equivalent (WCAG 1.1.1). */}
      <Box component="details" sx={{ mt: 1 }}>
        <Box component="summary" sx={{ cursor: 'pointer', fontSize: 12, color: 'text.secondary' }}>
          View this chart as a table
        </Box>
        <Box component="table" sx={{ width: '100%', mt: 1, fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Box component="th" sx={{ textAlign: 'left', p: 0.5 }}>Date</Box>
              <Box component="th" sx={{ textAlign: 'right', p: 0.5 }}>Outflow (CMS)</Box>
              <Box component="th" sx={{ textAlign: 'right', p: 0.5 }}>Gates</Box>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <Box component="td" sx={{ p: 0.5 }}>{p.date}</Box>
                <Box component="td" sx={{ p: 0.5, textAlign: 'right' }}>{p.outflowCms ?? '—'}</Box>
                <Box component="td" sx={{ p: 0.5, textAlign: 'right' }}>{p.gatesOpen ?? '—'}</Box>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}
