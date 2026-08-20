import { getDamHistory } from '@/lib/firebase/damRepository';
import { toHistoryPoint } from '@/lib/firebase/damSerializer';
import { DAM_REGISTRY, type DamId } from '@/lib/scrape/damRegistry';

export const runtime = 'nodejs';
/** Daily rollups change at most once a day; an hour of caching is generous. */
export const revalidate = 3600;

const MAX_DAYS = 90;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ damId: string }> },
) {
  const { damId } = await ctx.params;

  // Validate against the registry so an arbitrary path segment cannot be used
  // to probe for unrelated documents.
  if (!DAM_REGISTRY.some((d) => d.id === damId)) {
    return Response.json({ ok: false, error: `Unknown dam: ${damId}` }, { status: 404 });
  }

  const requested = Number(new URL(req.url).searchParams.get('days') ?? 30);
  const days = Math.min(MAX_DAYS, Math.max(1, Number.isFinite(requested) ? requested : 30));

  try {
    const rows = await getDamHistory(damId as DamId, days);
    return Response.json({
      ok: true,
      damId,
      days,
      points: rows.map((r) => toHistoryPoint(r as Record<string, unknown>)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/dams/${damId}/history] ${message}`);
    return Response.json({ ok: false, error: message, points: [] }, { status: 500 });
  }
}
