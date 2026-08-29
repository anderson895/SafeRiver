import { countActiveAlerts, getRecentAlerts } from '@/lib/alerts/alertRepository';

export const runtime = 'nodejs';
/** Alerts must surface quickly, but not at the cost of a Firestore read per visitor. */
export const revalidate = 60;

export async function GET(req: Request) {
  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get('limit') ?? 20)));

  try {
    // Counted across the collection, not within `alerts` — the caller chooses
    // `limit`, and counting inside it made the badge report the page size
    // instead of the truth.
    const [alerts, activeCount] = await Promise.all([getRecentAlerts(limit), countActiveAlerts()]);

    return Response.json({
      ok: true,
      alerts,
      activeCount,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/alerts] ${message}`);
    return Response.json({ ok: false, error: message, alerts: [] }, { status: 500 });
  }
}
