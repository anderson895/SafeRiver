'use client';

import PageHeader from '@/components/common/PageHeader';
import ComingSoon from '@/components/common/ComingSoon';
import { useI18n } from '@/i18n/I18nProvider';

export default function Page() {
  const { dict } = useI18n();
  const title = dict.nav.alerts;

  return (
    <>
      <PageHeader title={title} subtitle={dict.app.tagline} />
      <ComingSoon
        title={title}
        dataSource="Alert rule engine (in progress)"
        plannedFeatures={[
          'Active and past advisories',
          'Severity, trigger data and affected barangays',
          'Shareable alert permalinks',
          'Email subscription with double opt-in',
        ]}
      />
    </>
  );
}
