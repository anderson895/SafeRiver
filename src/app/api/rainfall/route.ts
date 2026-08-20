import { db, COLLECTIONS } from '@/lib/firebase/admin';
import { SAN_MANUEL } from '@/lib/rainfall/openMeteo';

export const runtime = 'nodejs';
/** The upstream forecast refreshes hourly; ten minutes is ample. */
export const revalidate = 600;

interface RadarFrame {
  time: number;
  path: string;
}

/**
 * Fetches the RainViewer frame index server-side.
 *
 * The index must be fetched here rather than from the browser because it sends
 * no CORS headers. The radar *tiles* themselves are plain images, which map
 * libraries load without CORS, so only this one call needs proxying.
 *
 * Returns null on any failure — radar is a supplementary layer and must never
 * take down the rainfall page.
 */
async function fetchRadar(): Promise<{ host: string; frames: RadarFrame[] } | null> {
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      host?: string;
      radar?: { past?: RadarFrame[]; nowcast?: RadarFrame[] };
    };

    const frames = [...(data.radar?.past ?? []), ...(data.radar?.nowcast ?? [])];
    if (!data.host || frames.length === 0) return null;

    // Keep the recent tail; older frames are not useful and bloat the payload.
    return { host: data.host, frames: frames.slice(-12) };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const snap = await db().collection(COLLECTIONS.rainfallCache).doc('sanmanuel').get();

    if (!snap.exists) {
      return Response.json(
        { ok: false, error: 'No rainfall data collected yet. Run the poll-rainfall cron.' },
        { status: 404 },
      );
    }

    const d = snap.data()!;
    const fetchedAt = d.fetchedAt?.toDate?.()?.toISOString() ?? null;
    const radar = await fetchRadar();

    return Response.json({
      ok: true,
      fetchedAt,
      ageMinutes: fetchedAt
        ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60_000)
        : null,
      location: d.location ?? { lat: SAN_MANUEL.lat, lon: SAN_MANUEL.lon, name: SAN_MANUEL.name },
      current: d.current ?? null,
      hourly: d.hourly ?? [],
      daily: d.daily ?? [],
      intensityClass: d.intensityClass ?? 'NONE',
      pagasaWarning: d.pagasaWarning ?? 'NONE',
      maxNext3hMm: d.maxNext3hMm ?? null,
      next24hTotalMm: d.next24hTotalMm ?? null,
      riverDischargeCms: d.riverDischargeCms ?? null,
      radar,
      source: 'open-meteo',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/rainfall] ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
