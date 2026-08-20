'use client';

import PageHeader from '@/components/common/PageHeader';
import ComingSoon from '@/components/common/ComingSoon';
import { useI18n } from '@/i18n/I18nProvider';

export default function Page() {
  const { dict } = useI18n();
  const title = dict.rainfall.title;

  return (
    <>
      <PageHeader title={title} subtitle={dict.app.tagline} />
      <ComingSoon
        title={title}
        dataSource="Open-Meteo (live)"
        plannedFeatures={[
          'Rainfall map with intensity legend',
          'Current rainfall reading in mm/hr',
          '24-hour forecast bar chart',
          'PAGASA yellow/orange/red classification',
        ]}
      />
    </>
  );
}
