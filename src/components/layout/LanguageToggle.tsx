'use client';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useI18n } from '@/i18n/I18nProvider';
import type { Lang } from '@/i18n/lang';

export default function LanguageToggle() {
  const { lang, setLang, dict } = useI18n();

  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={lang}
      onChange={(_, next: Lang | null) => next && setLang(next)}
      aria-label={dict.a11y.language}
      sx={{
        '& .MuiToggleButton-root': { px: 1.25, py: 0.25, fontSize: 12, fontWeight: 700 },
      }}
    >
      <ToggleButton value="en" aria-label="English">EN</ToggleButton>
      <ToggleButton value="tl" aria-label="Tagalog">TL</ToggleButton>
    </ToggleButtonGroup>
  );
}
