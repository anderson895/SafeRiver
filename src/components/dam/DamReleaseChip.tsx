'use client';

import Chip from '@mui/material/Chip';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import FiberManualRecord from '@mui/icons-material/FiberManualRecord';
import HelpOutlined from '@mui/icons-material/HelpOutlined';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Release state as a chip — releasing, not releasing, or not reported.
 *
 * Three states, because the bulletin has three. This lived inline on three
 * pages as a pair of ternaries on a boolean, which meant an unpublished figure
 * rendered as a green "Normal Operation" badge — on San Roque above all, whose
 * gate and outflow columns PAGASA usually leaves blank, and which is the dam
 * inside San Manuel. Centralised so the three pages cannot drift apart on what
 * silence means.
 *
 * Icon and text always carry the meaning alongside the colour (WCAG 1.4.1).
 */
export default function DamReleaseChip({ isReleasing }: { isReleasing: boolean | null }) {
  const { dict } = useI18n();

  if (isReleasing == null) {
    return (
      <Chip
        size="small"
        icon={<HelpOutlined />}
        color="default"
        variant="outlined"
        label={dict.dam.releaseUnknown}
      />
    );
  }

  return (
    <Chip
      size="small"
      icon={isReleasing ? <WarningAmberOutlined /> : <FiberManualRecord />}
      color={isReleasing ? 'error' : 'success'}
      variant={isReleasing ? 'filled' : 'outlined'}
      label={isReleasing ? dict.dam.releasing : dict.dam.normalOperation}
    />
  );
}
