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
 * Nulls are plotted as GAPS, not as zero.
 *
 * This file previously argued the opposite — that a blank means "no release
 * reported" and so belongs on the axis at 0. That is wrong, and the accessible
 * table below gave it away: the table rendered null as "—" while the line was
 * drawn through 0.00, so the same data told two contradictory stories and the
 * chart was the one people read. For San Roque, whose outflow column PAGASA
 * leaves blank in most bulletins, it drew a flat red line along zero for thirty
 * days — an assertion of "released nothing all month" built entirely out of
 * missing data.
 *
 * The scraper already distinguishes the two: a published "0" parses to 0, an
 * empty cell to null. That distinction has to survive to the chart.
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

  const values = points.map((p) => p.outflowCms);

  // Every value missing is not a flat line at zero, it is no series at all.
  // Say which dam this happens to and why, rather than drawing nothing.
  if (!values.some((v) => v != null)) {
    return (
      <Stack
        spacing={1}
        sx={{ height, alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }} color="text.secondary">
          {dict.dam.releaseUnknown}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 420 }}>
          The PAGASA bulletin leaves this dam&apos;s outflow column blank, so there is no release
          figure to chart. Blank is not zero — an unreported release is not a release of nothing.
        </Typography>
      </Stack>
    );
  }

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
            // Explicit, though it is the default: a day with no published
            // figure must break the line rather than be bridged across.
            connectNulls: false,
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
