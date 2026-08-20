'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ConstructionOutlined from '@mui/icons-material/ConstructionOutlined';

/**
 * Placeholder for routes that exist in navigation but are not built yet.
 *
 * Deliberately explicit about what is and is not working, and about which data
 * source will back the page. A blank screen during a demo reads as broken; a
 * labelled placeholder reads as planned.
 */
export default function ComingSoon({
  title,
  dataSource,
  plannedFeatures,
}: {
  title: string;
  dataSource: string;
  plannedFeatures: string[];
}) {
  return (
    <Card>
      <CardContent sx={{ py: 5 }}>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <ConstructionOutlined sx={{ fontSize: 44, color: 'text.disabled' }} />
          <Typography variant="h6">{title}</Typography>
          <Chip size="small" color="primary" variant="outlined" label="In development" />

          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>
            Data source: <strong>{dataSource}</strong> — already connected and collecting.
            This page will present it.
          </Typography>

          <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5, textAlign: 'left' }}>
            {plannedFeatures.map((f) => (
              <Typography key={f} component="li" variant="body2" color="text.secondary">
                {f}
              </Typography>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
