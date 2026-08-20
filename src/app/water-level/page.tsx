'use client';

import PageHeader from '@/components/common/PageHeader';
import ComingSoon from '@/components/common/ComingSoon';
import { useI18n } from '@/i18n/I18nProvider';

export default function Page() {
  const { dict } = useI18n();
  const title = dict.water.title;

  return (
    <>
      <PageHeader title={title} subtitle={dict.app.tagline} />
      <ComingSoon
        title={title}
        dataSource="PAGASA dam bulletin (live)"
        plannedFeatures={[
          'Dam selector for the three Agno dams',
          'Current level against Normal / Alert / Critical',
          'Reservoir level trend chart',
          'Agno River discharge from GloFAS',
        ]}
      />
    </>
  );
}
