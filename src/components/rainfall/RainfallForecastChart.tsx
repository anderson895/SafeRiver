'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { BarChart } from '@mui/x-charts/BarChart';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import { RAINFALL_THRESHOLDS } from '@/lib/rainfall/openMeteo';
import { useI18n } from '@/i18n/I18nProvider';

export interface HourlyPoint {
  t: string;
  precipitationMm: number | null;
  probability: number | null;
}

/**
 * Next 24 hours of precipitation.
 *
 * This is the only genuinely hourly series in the system — the dam bulletin is
 * published once a day — so unlike the reservoir charts, the reference design's
 * "next 24 hours" framing is accurate here and is kept as drawn.
 *
 * PAGASA's yellow/orange thresholds are drawn as reference lines so a bar can
 * be read against the same scale the alert engine uses.
 */
export default function RainfallForecastChart({
  hourly,
  hours = 24,
  height = 260,
}: {
  hourly: HourlyPoint[];
  hours?: number;
  height?: number;
}) {
  const { dict } = useI18n();
  const points = hourly.slice(0, hours);

  if (points.length === 0) {
    return (
      <Stack sx={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {dict.common.noData}
        </Typography>
      </Stack>
    );
  }

  const values = points.map((p) => p.precipitationMm ?? 0);
  const peak = Math.max(...values);

  return (
    <Box sx={{ width: '100%' }}>
      <BarChart
        height={height}
        series={[
          {
            data: values,
            label: dict.rainfall.forecast,
            color: '#1565C0',
            valueFormatter: (v) => (v == null ? '—' : `${v} mm`),
          },
        ]}
        xAxis={[
          {
            // Hour-of-day only; the date is implied by "next 24 hours".
            data: points.map((p) => p.t.slice(11, 13) + 'h'),
            scaleType: 'band',
          },
        ]}
        yAxis={[{ min: 0, label: 'mm/hr' }]}
        margin={{ left: 12, right: 16, top: 20, bottom: 24 }}
        hideLegend
      >
        {/* Only draw a threshold line when the forecast gets near it, otherwise
            the bars are squashed against the axis by an irrelevant reference. */}
        {peak >= RAINFALL_THRESHOLDS.yellow * 0.6 && (
          <ChartsReferenceLine
            y={RAINFALL_THRESHOLDS.yellow}
            label="Yellow"
            lineStyle={{ stroke: '#FBC02D', strokeDasharray: '5 5' }}
            labelStyle={{ fontSize: 11, fill: '#B58900' }}
          />
        )}
        {peak >= RAINFALL_THRESHOLDS.orange * 0.6 && (
          <ChartsReferenceLine
            y={RAINFALL_THRESHOLDS.orange}
            label="Orange"
            lineStyle={{ stroke: '#F57C00', strokeDasharray: '5 5' }}
            labelStyle={{ fontSize: 11, fill: '#F57C00' }}
          />
        )}
      </BarChart>

      {/* SVG charts expose nothing to screen readers (WCAG 1.1.1). */}
      <Box component="details" sx={{ mt: 1 }}>
        <Box component="summary" sx={{ cursor: 'pointer', fontSize: 12, color: 'text.secondary' }}>
          View this chart as a table
        </Box>
        <Box component="table" sx={{ width: '100%', mt: 1, fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Box component="th" sx={{ textAlign: 'left', p: 0.5 }}>Hour (PHT)</Box>
              <Box component="th" sx={{ textAlign: 'right', p: 0.5 }}>Rain (mm)</Box>
              <Box component="th" sx={{ textAlign: 'right', p: 0.5 }}>Chance</Box>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.t}>
                <Box component="td" sx={{ p: 0.5 }}>{p.t.replace('T', ' ')}</Box>
                <Box component="td" sx={{ p: 0.5, textAlign: 'right' }}>{p.precipitationMm ?? '—'}</Box>
                <Box component="td" sx={{ p: 0.5, textAlign: 'right' }}>
                  {p.probability != null ? `${p.probability}%` : '—'}
                </Box>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}
