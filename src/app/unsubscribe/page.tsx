'use client';

import PageHeader from '@/components/common/PageHeader';
import TokenResultCard from '@/components/common/TokenResultCard';
import { useI18n } from '@/i18n/I18nProvider';

export default function UnsubscribePage() {
  const { dict, lang } = useI18n();
  const isTl = lang === 'tl';

  return (
    <>
      <PageHeader
        title={isTl ? 'Pag-unsubscribe' : 'Unsubscribe'}
        subtitle={dict.app.tagline}
      />
      <TokenResultCard
        endpoint="/api/unsubscribe"
        copy={{
          working: isTl ? 'Ini-unsubscribe…' : 'Unsubscribing…',
          okTitle: isTl ? 'Na-unsubscribe na kayo' : 'You have been unsubscribed',
          okBody: isTl
            ? 'Hindi na kayo makakatanggap ng mga babala. Maaari kayong mag-subscribe ulit anumang oras.'
            : 'You will no longer receive alerts. You can subscribe again at any time.',
          failTitle: isTl ? 'Hindi na-proseso' : 'Could not unsubscribe',
          failBody: {
            'bad-signature': isTl
              ? 'Hindi wasto ang link. Siguraduhing buo ang na-kopya mula sa email.'
              : 'This link is not valid. Make sure you copied the whole link from the email.',
            malformed: isTl
              ? 'Hindi kumpleto ang link.'
              : 'The link is incomplete.',
            default: isTl
              ? 'May naganap na problema. Maaari kayong mag-reply sa alert email para mag-unsubscribe nang manu-mano.'
              : 'Something went wrong. You can reply to any alert email to unsubscribe manually.',
          },
          homeCta: isTl ? 'Pumunta sa dashboard' : 'Go to dashboard',
        }}
      />
    </>
  );
}
