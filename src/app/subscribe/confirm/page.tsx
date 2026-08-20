'use client';

import PageHeader from '@/components/common/PageHeader';
import TokenResultCard from '@/components/common/TokenResultCard';
import { useI18n } from '@/i18n/I18nProvider';

export default function ConfirmPage() {
  const { dict, lang } = useI18n();
  const isTl = lang === 'tl';

  return (
    <>
      <PageHeader
        title={isTl ? 'Kumpirmasyon' : 'Confirmation'}
        subtitle={dict.app.tagline}
      />
      <TokenResultCard
        endpoint="/api/subscribe/confirm"
        copy={{
          working: isTl ? 'Kinukumpirma…' : 'Confirming…',
          okTitle: isTl ? 'Aktibo na ang subscription' : 'Subscription active',
          okBody: isTl
            ? 'Makakatanggap na kayo ng babala tungkol sa pagpapakawala ng tubig, lebel ng tubig, at malakas na pag-ulan.'
            : 'You will now receive alerts about water releases, reservoir levels, and heavy rainfall.',
          failTitle: isTl ? 'Hindi na-kumpirma' : 'Could not confirm',
          failBody: {
            expired: isTl
              ? 'Expired na ang link (48 oras lang ang bisa). Mag-subscribe ulit para makakuha ng bago.'
              : 'This link has expired (they are valid for 48 hours). Please subscribe again to get a new one.',
            'not-found': isTl
              ? 'Walang nahanap na subscription para sa link na ito.'
              : 'No subscription was found for this link.',
            'bad-signature': isTl
              ? 'Hindi wasto ang link. Siguraduhing buo ang na-kopya mula sa email.'
              : 'This link is not valid. Make sure you copied the whole link from the email.',
            malformed: isTl
              ? 'Hindi kumpleto ang link. Subukang i-click ulit mula sa email.'
              : 'The link is incomplete. Try clicking it again from the email.',
            default: isTl ? 'May naganap na problema.' : 'Something went wrong.',
          },
          homeCta: isTl ? 'Pumunta sa dashboard' : 'Go to dashboard',
        }}
      />
    </>
  );
}
