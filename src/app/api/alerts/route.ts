import { getRecentAlerts } from '@/lib/alerts/alertRepository';

export const runtime = 'nodejs';
/** Alerts must surface quickly, but not at the cost of a Firestore read per visitor. */
export const revalidate = 60;

export async function GET(req: Request) {
  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get('limit') ?? 20)));

  try {
    const alerts = await getRecentAlerts(limit);
    return Response.json({
      ok: true,
      alerts,
      activeCount: alerts.filter((a) => a.isActive).length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/alerts] ${message}`);
    return Response.json({ ok: false, error: message, alerts: [] }, { status: 500 });
  }
}
