'use client';

import PageHeader from '@/components/common/PageHeader';
import ComingSoon from '@/components/common/ComingSoon';
import { useI18n } from '@/i18n/I18nProvider';

export default function Page() {
  const { dict } = useI18n();
  const title = dict.floodInfo.title;

  return (
    <>
      <PageHeader title={title} subtitle={dict.app.tagline} />
      <ComingSoon
        title={title}
        dataSource="Bilingual educational content"
        plannedFeatures={[
          'What is a flood, and local causes',
          'Types of floods',
          'Before / during / after a flood',
          'Flood safety tips',
        ]}
      />
    </>
  );
}
