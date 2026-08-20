'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Skeleton from '@mui/material/Skeleton';
import { HAZARD_COLORS, HAZARD_LABELS } from '@/theme/theme';
import type { ReturnPeriod } from '@/components/map/HazardMap';

// MapLibre touches `window` at import time, so it must never be server-rendered.
const HazardMap = dynamic(() => import('@/components/map/HazardMap'), {
  ssr: false,
  loading: () => <Skeleton variant="rectangular" height={520} sx={{ borderRadius: 3 }} />,
});

export default function Home() {
  const [returnPeriod, setReturnPeriod] = useState<ReturnPeriod>('100yr');

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h1" gutterBottom>
        Interactive Flood Hazard Map
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        San Manuel, Pangasinan — Agno River
      </Typography>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{
              mb: 2,
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'center' },
            }}
          >
            <ToggleButtonGroup
              size="small"
              exclusive
              value={returnPeriod}
              onChange={(_, v: ReturnPeriod | null) => v && setReturnPeriod(v)}
              aria-label="Flood return period"
            >
              <ToggleButton value="5yr">5-year</ToggleButton>
              <ToggleButton value="25yr">25-year</ToggleButton>
              <ToggleButton value="100yr">100-year</ToggleButton>
            </ToggleButtonGroup>

            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {([1, 2, 3] as const).map((v) => (
                <Stack key={v} direction="row" spacing={0.75} alignItems="center">
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: 0.5,
                      bgcolor: HAZARD_COLORS[v],
                      border: '1px solid rgba(0,0,0,0.2)',
                    }}
                  />
                  <Typography variant="caption">{HAZARD_LABELS[v].en}</Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>

          <HazardMap returnPeriod={returnPeriod} />

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            Flood hazard data © Project NOAH / UP NOAH Center, licensed under ODbL. Basemap ©
            OpenFreeMap, © OpenMapTiles, data from OpenStreetMap contributors.
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
