'use client';

import PageHeader from '@/components/common/PageHeader';
import ComingSoon from '@/components/common/ComingSoon';
import { useI18n } from '@/i18n/I18nProvider';

export default function Page() {
  const { dict } = useI18n();
  const title = dict.dam.title;

  return (
    <>
      <PageHeader title={title} subtitle={dict.app.tagline} />
      <ComingSoon
        title={title}
        dataSource="PAGASA dam bulletin (live)"
        plannedFeatures={[
          'San Roque / Binga / Ambuklao status cards',
          'Current release in CMS and gates open',
          '30-day release history chart',
          'Manual advisory posting by DRRM staff',
        ]}
      />
    </>
  );
}
