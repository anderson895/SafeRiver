import 'server-only';
import { db, COLLECTIONS, Timestamp } from '@/lib/firebase/admin';
import { subscriberId } from './tokens';
import type { Lang } from '@/i18n/lang';
import type { Severity } from '@/lib/alerts/types';

export type SubscriberStatus = 'PENDING' | 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED';

export interface Subscriber {
  id: string;
  email: string;
  status: SubscriberStatus;
  language: Lang;
  barangay: string | null;
  /** Lowest severity worth emailing this person about. */
  minSeverity: Extract<Severity, 'ADVISORY' | 'WATCH' | 'WARNING'>;
  createdAt: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  lastEmailedAt: string | null;
  emailsToday: number;
  emailCountDate: string | null;
}

export interface ConsentEvidence {
  ip: string | null;
  userAgent: string | null;
}

/**
 * Creates or re-arms a pending subscription.
 *
 * Returns `alreadyActive` rather than erroring so the API can respond
 * identically in every case. Revealing whether an address is already
 * subscribed would turn this endpoint into a membership oracle.
 */
export async function upsertPending(
  email: string,
  language: Lang,
  barangay: string | null,
  consent: ConsentEvidence,
  now: Date,
): Promise<{ id: string; alreadyActive: boolean }> {
  const id = subscriberId(email);
  const ref = db().collection(COLLECTIONS.subscribers).doc(id);
  const snap = await ref.get();

  if (snap.exists && snap.get('status') === 'ACTIVE') {
    return { id, alreadyActive: true };
  }

  await ref.set(
    {
      email: email.trim(),
      emailLower: email.trim().toLowerCase(),
      status: 'PENDING',
      language,
      barangay,
      minSeverity: snap.get('minSeverity') ?? 'ADVISORY',
      // RA 10173 requires demonstrable consent. Store when and from where.
      consentIp: consent.ip,
      consentUserAgent: consent.userAgent,
      createdAt: snap.get('createdAt') ?? Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      confirmedAt: null,
      unsubscribedAt: null,
    },
    { merge: true },
  );

  return { id, alreadyActive: false };
}

/** Activates a pending subscription. Idempotent: a replayed link is harmless. */
export async function confirmSubscriber(
  id: string,
  now: Date,
): Promise<'confirmed' | 'already-active' | 'not-found'> {
  const ref = db().collection(COLLECTIONS.subscribers).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return 'not-found';
  if (snap.get('status') === 'ACTIVE') return 'already-active';

  await ref.set(
    { status: 'ACTIVE', confirmedAt: Timestamp.fromDate(now), unsubscribedAt: null },
    { merge: true },
  );
  return 'confirmed';
}

/**
 * Unsubscribes.
 *
 * The record is retained rather than deleted so the address is not silently
 * re-subscribable by a third party and so consent history stays auditable.
 * A genuine erasure request is handled by deleteSubscriber().
 */
export async function unsubscribe(id: string, now: Date): Promise<'ok' | 'not-found'> {
  const ref = db().collection(COLLECTIONS.subscribers).doc(id);
  if (!(await ref.get()).exists) return 'not-found';

  await ref.set(
    { status: 'UNSUBSCRIBED', unsubscribedAt: Timestamp.fromDate(now) },
    { merge: true },
  );
  return 'ok';
}

/** Hard delete, for a data-subject erasure request under RA 10173. */
export async function deleteSubscriber(id: string): Promise<void> {
  await db().collection(COLLECTIONS.subscribers).doc(id).delete();
}

export async function getSubscriber(id: string): Promise<Subscriber | null> {
  const snap = await db().collection(COLLECTIONS.subscribers).doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  const iso = (v: unknown) => (v as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null;

  return {
    id: snap.id,
    email: d.email as string,
    status: d.status as SubscriberStatus,
    language: (d.language as Lang) ?? 'en',
    barangay: (d.barangay as string | null) ?? null,
    minSeverity: (d.minSeverity as Subscriber['minSeverity']) ?? 'ADVISORY',
    createdAt: iso(d.createdAt),
    confirmedAt: iso(d.confirmedAt),
    unsubscribedAt: iso(d.unsubscribedAt),
    lastEmailedAt: iso(d.lastEmailedAt),
    emailsToday: (d.emailsToday as number) ?? 0,
    emailCountDate: (d.emailCountDate as string) ?? null,
  };
}

export async function countActive(): Promise<number> {
  const { count } = (
    await db().collection(COLLECTIONS.subscribers).where('status', '==', 'ACTIVE').count().get()
  ).data();
  return count;
}
