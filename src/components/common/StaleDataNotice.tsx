'use client';

import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Warns when a reading is old.
 *
 * PAGASA publishes once daily at 08:00, so data is routinely several hours old
 * and that is normal. Beyond the threshold, though, silence would be dangerous:
 * presenting yesterday's "not releasing" as if it were current is exactly the
 * failure this system exists to prevent. Say it out loud instead.
 */
export default function StaleDataNotice({
  ageHours,
  thresholdHours = 30,
}: {
  ageHours: number | null;
  thresholdHours?: number;
}) {
  const { dict } = useI18n();
  if (ageHours == null || ageHours < thresholdHours) return null;

  return (
    <Alert severity="warning" variant="outlined" sx={{ mb: 2, py: 0.5 }}>
      <Typography variant="caption">
        {dict.common.staleWarning.replace('{hours}', String(Math.floor(ageHours)))}
      </Typography>
    </Alert>
  );
}
