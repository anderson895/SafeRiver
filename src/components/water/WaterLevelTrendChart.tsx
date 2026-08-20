'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import type { DamHistoryPoint } from '@/types/dam';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Reservoir water level over time, with the Normal / Alert / Critical
 * thresholds drawn as dashed reference lines.
 *
 * Labelled by real span ("Last N days") rather than the mockup's "24 hours":
 * PAGASA publishes one bulletin per day, so an hourly series is not obtainable
 * and claiming one would be a fabrication.
 */
export default function WaterLevelTrendChart({
  points,
  thresholds,
  height = 300,
}: {
  points: DamHistoryPoint[];
  thresholds: { normal: number | null; alert: number | null; critical: number | null };
  height?: number;
}) {
  const { dict } = useI18n();

  const usable = points.filter((p) => p.rwl != null);

  if (usable.length < 2) {
    return (
      <Stack
        spacing={1}
        sx={{ height, alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }} color="text.secondary">
          {dict.common.noData}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 380 }}>
          The dam bulletin is published once daily, so this chart fills in one point per day as
          readings accumulate. Currently {usable.length} of the requested days.
        </Typography>
      </Stack>
    );
  }

  const values = usable.map((p) => p.rwl as number);
  const candidates = [
    ...values,
    ...[thresholds.normal, thresholds.alert, thresholds.critical].filter(
      (v): v is number => v != null,
    ),
  ];
  // Pad the axis so threshold lines are never flush against the chart edge.
  const min = Math.min(...candidates);
  const max = Math.max(...candidates);
  const pad = Math.max(0.5, (max - min) * 0.12);

  return (
    <Box sx={{ width: '100%' }}>
      <LineChart
        height={height}
        series={[
          {
            data: values,
            label: dict.water.currentLevel,
            color: '#1565C0',
            showMark: usable.length <= 20,
            curve: 'monotoneX',
            valueFormatter: (v) => (v == null ? '—' : `${v} m`),
          },
        ]}
        xAxis={[
          {
            data: usable.map((p) => p.date.slice(5)), // MM-DD keeps labels readable
            scaleType: 'point',
          },
        ]}
        yAxis={[{ min: min - pad, max: max + pad, label: 'masl' }]}
        margin={{ left: 12, right: 16, top: 20, bottom: 24 }}
        hideLegend
      >
        {thresholds.normal != null && (
          <ChartsReferenceLine
            y={thresholds.normal}
            label="Normal"
            lineStyle={{ stroke: '#0288D1', strokeDasharray: '5 5' }}
            labelStyle={{ fontSize: 11, fill: '#0288D1' }}
          />
        )}
        {thresholds.alert != null && (
          <ChartsReferenceLine
            y={thresholds.alert}
            label="Alert"
            lineStyle={{ stroke: '#F57C00', strokeDasharray: '5 5' }}
            labelStyle={{ fontSize: 11, fill: '#F57C00' }}
          />
        )}
        {thresholds.critical != null && (
          <ChartsReferenceLine
            y={thresholds.critical}
            label="Critical"
            lineStyle={{ stroke: '#D32F2F', strokeDasharray: '5 5' }}
            labelStyle={{ fontSize: 11, fill: '#D32F2F' }}
          />
        )}
      </LineChart>

      {/* MUI X Charts renders SVG, which screen readers get nothing from.
          A table alternative is a WCAG requirement, not a nicety. */}
      <Box component="details" sx={{ mt: 1 }}>
        <Box component="summary" sx={{ cursor: 'pointer', fontSize: 12, color: 'text.secondary' }}>
          View this chart as a table
        </Box>
        <Box component="table" sx={{ width: '100%', mt: 1, fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Box component="th" sx={{ textAlign: 'left', p: 0.5 }}>Date</Box>
              <Box component="th" sx={{ textAlign: 'right', p: 0.5 }}>Water level (masl)</Box>
            </tr>
          </thead>
          <tbody>
            {usable.map((p) => (
              <tr key={p.date}>
                <Box component="td" sx={{ p: 0.5 }}>{p.date}</Box>
                <Box component="td" sx={{ p: 0.5, textAlign: 'right' }}>{p.rwl}</Box>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}
