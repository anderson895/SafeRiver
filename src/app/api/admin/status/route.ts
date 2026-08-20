import { adminGuard } from '@/lib/auth/verifyAdmin';
import { db, COLLECTIONS } from '@/lib/firebase/admin';
import { getLatestReadings } from '@/lib/firebase/damRepository';
import { toDamDto } from '@/lib/firebase/damSerializer';
import { countActive } from '@/lib/email/subscriberRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * System health for the admin dashboard.
 *
 * Surfaces the failures that are otherwise silent: a scraper that has stopped,
 * a queue that is not draining, alerts disabled in production. Each of those
 * looks identical to "nothing is happening" from the public site.
 */
export async function GET(req: Request) {
  const guard = await adminGuard(req, ['SUPER_ADMIN', 'DRRM_OFFICER', 'VIEWER']);
  if ('response' in guard) return guard.response;

  try {
    const database = db();
    const now = new Date();

    const [healthSnap, dams, activeSubscribers, jobsSnap] = await Promise.all([
      database.collection(COLLECTIONS.config).doc('systemHealth').get(),
      getLatestReadings(),
      countActive(),
      database.collection(COLLECTIONS.emailJobs).where('status', 'in', ['QUEUED', 'SENDING']).get(),
    ]);

    const h = healthSnap.data() ?? {};
    const iso = (v: unknown) => (v as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null;
    const ageMin = (v: unknown) => {
      const d = (v as { toDate?: () => Date })?.toDate?.();
      return d ? Math.round((now.getTime() - d.getTime()) / 60_000) : null;
    };

    const agno = dams
      .map((d) => toDamDto(d as Record<string, unknown>, now))
      .filter((d) => d.isAgno);

    return Response.json({
      ok: true,
      admin: { email: guard.admin.email, role: guard.admin.role },
      scrape: {
        ok: h.lastDamScrape?.ok ?? null,
        at: iso(h.lastDamScrape?.at),
        ageMinutes: ageMin(h.lastDamScrape?.at),
        damsParsed: h.lastDamScrape?.damsParsed ?? null,
        error: h.lastDamScrape?.error ?? null,
        consecutiveFailures: h.consecutiveScrapeFailures ?? 0,
      },
      rainfall: {
        ok: h.lastRainfallFetch?.ok ?? null,
        at: iso(h.lastRainfallFetch?.at),
        ageMinutes: ageMin(h.lastRainfallFetch?.at),
        error: h.lastRainfallFetch?.error ?? null,
      },
      email: {
        // Reported so an operator can see at a glance why nothing is sending.
        alertsEnabled: process.env.ALERTS_ENABLED === 'true',
        activeSubscribers,
        pendingJobs: jobsSnap.size,
      },
      agno: agno.map((d) => ({
        damId: d.damId,
        damName: d.damName,
        rwl: d.rwl,
        nhwl: d.nhwl,
        outflowCms: d.outflowCms,
        gatesOpen: d.gatesOpen,
        isReleasing: d.isReleasing,
        trend: d.trend,
        observedAt: d.observedAt,
      })),
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/admin/status] ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
