import { z } from 'zod';
import { adminGuard } from '@/lib/auth/verifyAdmin';
import { db, COLLECTIONS, Timestamp } from '@/lib/firebase/admin';
import { queueAlertEmail } from '@/lib/email/dispatcher';
import { SEVERITY_RANK, type Severity } from '@/lib/alerts/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z.object({
  severity: z.enum(['ADVISORY', 'WATCH', 'WARNING', 'CRITICAL']),
  category: z.enum(['DAM_RELEASE', 'WATER_LEVEL', 'RAINFALL', 'FLOOD', 'GENERAL']),
  // Tagalog is optional. Requiring it meant an officer announcing a live gate
  // release had to compose two languages before anything could go out, and
  // `pick()` already falls back to English for readers set to Tagalog. A late
  // warning in one language beats a timely warning in none.
  title: z.object({ en: z.string().min(3).max(160), tl: z.string().max(160).default('') }),
  body: z.object({ en: z.string().min(3).max(1200), tl: z.string().max(1200).default('') }),
  actionAdvice: z.object({ en: z.string().max(600), tl: z.string().max(600) }),
  affectedBarangays: z.array(z.string().max(80)).max(20).default([]),
  /** Send email as well as posting to the site. */
  notify: z.boolean().default(true),
});

/**
 * Posts a manual advisory.
 *
 * This is why the admin panel exists. San Roque Power Corporation announces
 * actual gate releases on Facebook and in PDFs — there is no machine-readable
 * feed — so the scraper can only ever report yesterday's published reservoir
 * level. Without this endpoint the system could never announce a real release
 * as it happens, which is the single event it exists to warn about.
 *
 * Manual advisories are recorded with `origin: 'MANUAL'` and deliberately do
 * NOT touch alertState. A human has decided this is worth sending, so cooldown
 * does not apply — and equally, a manual post must never suppress or cancel an
 * automated alert that the rule engine would otherwise raise.
 */
export async function POST(req: Request) {
  const guard = await adminGuard(req);
  if ('response' in guard) return guard.response;

  const now = new Date();

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const severity = input.severity as Severity;

    const ref = db().collection(COLLECTIONS.alerts).doc();
    await ref.set({
      signalKey: `MANUAL:${input.category}:${ref.id}`,
      category: input.category,
      severity,
      origin: 'MANUAL',
      reason: 'MANUAL',
      title: input.title,
      body: input.body,
      actionAdvice: input.actionAdvice,
      affectedBarangays: input.affectedBarangays,
      triggerData: { metric: 'manual', value: null, threshold: null, unit: '' },
      issuedAt: Timestamp.fromDate(now),
      isActive: true,
      publishedBy: guard.admin.uid,
      publishedByEmail: guard.admin.email,
      createdAt: Timestamp.now(),
    });

    let jobId: string | null = null;
    if (input.notify) {
      jobId = await queueAlertEmail(ref.id, now);
      await ref.set({ emailJobId: jobId }, { merge: true });
    }

    return Response.json({
      ok: true,
      alertId: ref.id,
      jobId,
      severityRank: SEVERITY_RANK[severity],
      notify: input.notify,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/admin/advisories] ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Recent manual advisories, for the admin list. */
export async function GET(req: Request) {
  const guard = await adminGuard(req, ['SUPER_ADMIN', 'DRRM_OFFICER', 'VIEWER']);
  if ('response' in guard) return guard.response;

  const snap = await db()
    .collection(COLLECTIONS.alerts)
    .orderBy('issuedAt', 'desc')
    .limit(30)
    .get();

  return Response.json({
    ok: true,
    advisories: snap.docs.map((d) => ({
      id: d.id,
      severity: d.get('severity'),
      category: d.get('category'),
      origin: d.get('origin'),
      title: d.get('title'),
      issuedAt: d.get('issuedAt')?.toDate?.()?.toISOString() ?? null,
      publishedByEmail: d.get('publishedByEmail') ?? null,
      isActive: Boolean(d.get('isActive')),
    })),
  });
}
