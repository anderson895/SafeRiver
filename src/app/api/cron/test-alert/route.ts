import { cronGuard } from '@/lib/auth/verifyCron';
import { db, COLLECTIONS, Timestamp } from '@/lib/firebase/admin';
import { queueAlertEmail } from '@/lib/email/dispatcher';
import { compose } from '@/lib/alerts/compose';
import type { Signal, Severity } from '@/lib/alerts/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Fires a synthetic alert through the real pipeline.
 *
 * Two purposes:
 *  - Verifying the dispatcher without waiting for the Agno to actually flood.
 *  - Demonstrating a live end-to-end alert during the thesis defense
 *    regardless of what the weather is doing on the day.
 *
 * It deliberately does NOT touch alertState, so it can never suppress or
 * cancel a genuine alert, and a real condition arriving moments later still
 * fires normally.
 *
 * Every message it produces is clearly marked as a test, so a subscriber who
 * receives one is never misled into acting on it.
 */
export async function POST(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;

  const now = new Date();
  const url = new URL(req.url);
  const severity = ((url.searchParams.get('severity') ?? 'WARNING').toUpperCase() as Severity);

  const signal: Signal = {
    signalKey: `TEST:san-roque:outflow:${now.getTime()}`,
    category: 'DAM_RELEASE',
    severity,
    trigger: {
      metric: 'outflowCms',
      value: 2700,
      threshold: 2500,
      unit: 'CMS',
      damId: 'san-roque',
      damName: 'San Roque Dam',
      observedAt: now.toISOString(),
      nhwl: 280,
    },
  };

  const content = compose(signal, severity);
  const marker = { en: '[TEST] ', tl: '[PAGSUBOK] ' };

  const ref = db().collection(COLLECTIONS.alerts).doc();
  await ref.set({
    signalKey: signal.signalKey,
    category: signal.category,
    severity,
    origin: 'MANUAL',
    reason: 'TEST',
    isTest: true,
    title: { en: marker.en + content.title.en, tl: marker.tl + content.title.tl },
    body: {
      en: `THIS IS ONLY A TEST. ${content.body.en}`,
      tl: `PAGSUBOK LAMANG ITO. ${content.body.tl}`,
    },
    actionAdvice: content.actionAdvice,
    triggerData: signal.trigger,
    issuedAt: Timestamp.fromDate(now),
    isActive: true,
    createdAt: Timestamp.now(),
  });

  const jobId = await queueAlertEmail(ref.id, now);

  return Response.json({
    ok: true,
    alertId: ref.id,
    jobId,
    severity,
    note: 'Synthetic alert queued. Run /api/cron/dispatch to deliver it.',
  });
}

export const GET = POST;
