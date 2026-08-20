import 'server-only';
import { FieldPath } from 'firebase-admin/firestore';
import { db, COLLECTIONS, Timestamp } from '@/lib/firebase/admin';
import { sendAlertEmail, DAILY_SEND_CEILING, MAX_EMAILS_PER_SUBSCRIBER_PER_DAY } from './transport';
import { renderAlert } from './templates';
import { makeToken, hashEmail } from './tokens';
import { SEVERITY_RANK, type Severity } from '@/lib/alerts/types';
import { pick, type Lang } from '@/i18n/lang';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Leave headroom before Vercel's 60s function limit. */
const DEADLINE_MS = 45_000;
/** Subscribers fetched per Firestore page. */
const PAGE = 50;
/** Concurrent sends per wave. Gmail tolerates far less parallelism than a relay. */
const WAVE = 5;

function phtDateKey(d: Date): string {
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

export interface DispatchResult {
  jobId: string | null;
  sent: number;
  skipped: number;
  failed: number;
  hasMore: boolean;
  reason?: string;
}

/**
 * Drains one slice of the alert email queue.
 *
 * Returns `hasMore: true` when the deadline is hit mid-job; the GitHub Actions
 * loop then calls again with the cursor persisted on the job document. At
 * Gmail's deliberately low send rate a few hundred subscribers span more than
 * one invocation, so this pagination is load-bearing rather than theoretical.
 */
export async function dispatchOnce(now: Date = new Date()): Promise<DispatchResult> {
  const database = db();
  const deadline = Date.now() + DEADLINE_MS;

  if (process.env.ALERTS_ENABLED !== 'true') {
    return { jobId: null, sent: 0, skipped: 0, failed: 0, hasMore: false, reason: 'ALERTS_ENABLED is not true' };
  }

  // Oldest queued job first, so an alert cannot be starved by newer ones.
  //
  // Sorted in memory rather than with orderBy('createdAt'): combining a
  // `where` on status with an orderBy on a different field would demand a
  // composite index, and this project deliberately keeps its index set empty
  // so there is nothing to define, deploy or keep in sync. The queue holds one
  // job per fired alert and is drained continuously, so the candidate set is
  // tiny and the sort is free.
  const jobSnap = await database
    .collection(COLLECTIONS.emailJobs)
    .where('status', 'in', ['QUEUED', 'SENDING'])
    .limit(25)
    .get();

  if (jobSnap.empty) {
    return { jobId: null, sent: 0, skipped: 0, failed: 0, hasMore: false, reason: 'queue empty' };
  }

  const oldest = jobSnap.docs.reduce((a, b) => {
    const at = (a.get('createdAt') as { toMillis?: () => number })?.toMillis?.() ?? 0;
    const bt = (b.get('createdAt') as { toMillis?: () => number })?.toMillis?.() ?? 0;
    return bt < at ? b : a;
  });

  const jobRef = oldest.ref;
  const job = oldest.data();
  const jobId = jobRef.id;
  // More than one job outstanding means the caller should come back.
  const moreJobsQueued = jobSnap.size > 1;

  const alertSnap = await database.collection(COLLECTIONS.alerts).doc(job.alertId as string).get();
  if (!alertSnap.exists) {
    await jobRef.set({ status: 'FAILED', error: 'alert missing', finishedAt: Timestamp.fromDate(now) }, { merge: true });
    // Keep going if other jobs are waiting. Reporting hasMore:false here made a
    // single orphaned job halt the entire drain: the caller stopped, every
    // healthy job behind it stayed queued, and each subsequent run cleared only
    // one more orphan while appearing to do nothing at all.
    return { jobId, sent: 0, skipped: 0, failed: 0, hasMore: moreJobsQueued, reason: 'alert missing' };
  }

  const alert = alertSnap.data()!;
  const severity = alert.severity as Severity;
  const todayKey = phtDateKey(now);

  // Global daily ceiling, well under Gmail's ~500/day. Exceeding it would lock
  // SMTP for roughly a day and take the whole alert channel offline.
  const counterRef = database.collection(COLLECTIONS.config).doc('sendCounter');
  const counterSnap = await counterRef.get();
  let sentToday =
    counterSnap.get('date') === todayKey ? ((counterSnap.get('count') as number) ?? 0) : 0;

  if (sentToday >= DAILY_SEND_CEILING) {
    return { jobId, sent: 0, skipped: 0, failed: 0, hasMore: true, reason: 'daily ceiling reached' };
  }

  await jobRef.set({ status: 'SENDING', startedAt: job.startedAt ?? Timestamp.fromDate(now) }, { merge: true });

  let cursor = (job.cursor as string | null) ?? null;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let hasMore = false;

  while (Date.now() < deadline) {
    let query = database
      .collection(COLLECTIONS.subscribers)
      .where('status', '==', 'ACTIVE')
      .orderBy(FieldPath.documentId())
      .limit(PAGE);
    if (cursor) query = query.startAfter(cursor);

    const page = await query.get();
    if (page.empty) break;

    for (let i = 0; i < page.docs.length; i += WAVE) {
      if (Date.now() >= deadline) {
        hasMore = true;
        break;
      }

      const wave = page.docs.slice(i, i + WAVE);
      const results = await Promise.allSettled(
        wave.map(async (doc) => {
          const sub = doc.data();
          const subId = doc.id;

          // Respect the subscriber's severity floor.
          const floor = (sub.minSeverity as Severity) ?? 'ADVISORY';
          if (SEVERITY_RANK[severity] < SEVERITY_RANK[floor]) return 'skip' as const;

          // Per-subscriber daily cap: a runaway rule degrades to silence
          // rather than to hundreds of emails.
          const countDate = sub.emailCountDate as string | undefined;
          const countToday = countDate === todayKey ? ((sub.emailsToday as number) ?? 0) : 0;
          if (countToday >= MAX_EMAILS_PER_SUBSCRIBER_PER_DAY) return 'skip' as const;

          // Idempotency: a retried Actions run must not double-mail anyone.
          const logId = `${jobId}_${subId}`;
          const logRef = database.collection(COLLECTIONS.emailLog).doc(logId);
          if ((await logRef.get()).exists) return 'skip' as const;

          const lang = ((sub.language as Lang) ?? 'en') satisfies Lang;
          const unsubscribeUrl = `${SITE}/unsubscribe?token=${makeToken('unsubscribe', subId, now)}`;
          const trigger = alert.triggerData ?? {};

          const mail = renderAlert({
            severity,
            title: pick(alert.title, lang),
            body: pick(alert.body, lang),
            actionAdvice: pick(alert.actionAdvice, lang),
            subject: `[${severity}] ${pick(alert.title, lang)}`,
            detailsUrl: `${SITE}/alerts`,
            unsubscribeUrl,
            lang,
            facts:
              trigger.value != null
                ? [{ label: trigger.metric ?? 'value', value: `${trigger.value} ${trigger.unit ?? ''}`.trim() }]
                : undefined,
          });

          // One recipient per message. Never BCC: each needs its own
          // unsubscribe token, and a BCC blast would disclose every
          // subscriber's address to every other subscriber.
          await sendAlertEmail({
            to: sub.email as string,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            unsubscribeUrl,
          });

          await logRef.set({
            jobId,
            alertId: job.alertId,
            subscriberId: subId,
            emailHash: hashEmail(sub.email as string),
            status: 'SENT',
            at: Timestamp.fromDate(now),
          });

          await doc.ref.set(
            {
              lastEmailedAt: Timestamp.fromDate(now),
              emailCountDate: todayKey,
              emailsToday: countToday + 1,
            },
            { merge: true },
          );

          return 'sent' as const;
        }),
      );

      for (const r of results) {
        if (r.status === 'rejected') failed += 1;
        else if (r.value === 'sent') sent += 1;
        else skipped += 1;
      }

      cursor = wave[wave.length - 1].id;
      sentToday += sent;

      if (sentToday >= DAILY_SEND_CEILING) {
        hasMore = true;
        break;
      }
    }

    if (hasMore || page.size < PAGE) break;
  }

  const done = !hasMore;
  await jobRef.set(
    {
      status: done ? 'DONE' : 'SENDING',
      cursor: done ? null : cursor,
      sentCount: ((job.sentCount as number) ?? 0) + sent,
      failedCount: ((job.failedCount as number) ?? 0) + failed,
      finishedAt: done ? Timestamp.fromDate(now) : null,
    },
    { merge: true },
  );

  await counterRef.set({ date: todayKey, count: sentToday }, { merge: true });

  // Keep the caller looping while this job is unfinished OR other jobs are
  // still waiting behind it — otherwise a second queued alert would sit
  // undelivered until the next scheduled run.
  return { jobId, sent, skipped, failed, hasMore: hasMore || (done && moreJobsQueued) };
}

/** Queues an alert for fan-out. Called by the cron after an alert fires. */
export async function queueAlertEmail(alertId: string, now: Date): Promise<string> {
  const ref = db().collection(COLLECTIONS.emailJobs).doc();
  await ref.set({
    alertId,
    status: 'QUEUED',
    cursor: null,
    sentCount: 0,
    failedCount: 0,
    createdAt: Timestamp.fromDate(now),
    startedAt: null,
    finishedAt: null,
  });
  return ref.id;
}
