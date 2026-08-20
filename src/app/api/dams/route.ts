import { getLatestReadings } from '@/lib/firebase/damRepository';
import { toDamDto } from '@/lib/firebase/damSerializer';
import { AGNO_DAM_IDS } from '@/lib/scrape/damRegistry';
import type { DamDto } from '@/types/dam';

export const runtime = 'nodejs';

/**
 * Cached for 15 minutes.
 *
 * This is the quota firewall: the browser never queries Firestore directly for
 * public pages. One cached server read serves every visitor, so Firestore reads
 * stay flat (~250/day) instead of scaling with traffic toward the 50k/day free
 * tier ceiling. The upstream bulletin only changes once a day, so a 15-minute
 * window costs nothing in freshness.
 */
export const revalidate = 900;

export async function GET() {
  try {
    const docs = await getLatestReadings();
    const now = new Date();

    const dams = docs
      .map((d) => toDamDto(d as Record<string, unknown>, now))
      // Agno cascade first, ordered upstream -> downstream, then everything else.
      .sort((a, b) => {
        const ai = AGNO_DAM_IDS.indexOf(a.damId);
        const bi = AGNO_DAM_IDS.indexOf(b.damId);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.damName.localeCompare(b.damName);
      });

    const agno: DamDto[] = dams.filter((d) => d.isAgno);

    return Response.json({
      ok: true,
      dams,
      agno,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/dams] ${message}`);
    return Response.json({ ok: false, error: message, dams: [], agno: [] }, { status: 500 });
  }
}
