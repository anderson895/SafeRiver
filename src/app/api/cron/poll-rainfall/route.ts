import { cronGuard } from '@/lib/auth/verifyCron';
import { fetchRainfall } from '@/lib/rainfall/openMeteo';
import { db, COLLECTIONS, Timestamp } from '@/lib/firebase/admin';
import { phtDateKey } from '@/lib/firebase/damRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Scheduled rainfall + river-discharge poll (Open-Meteo).
 *
 * Writes a single overwritten cache document rather than a log: rainfall
 * forecasts are continuously revised, so only the newest matters for display.
 * A separate daily document accumulates observed totals, which is what the
 * historical chart needs.
 */
export async function POST(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;

  const startedAt = new Date();

  try {
    const snapshot = await fetchRainfall(startedAt);
    const database = db();

    await database
      .collection(COLLECTIONS.rainfallCache)
      .doc('sanmanuel')
      .set({
        ...snapshot,
        fetchedAt: Timestamp.fromDate(snapshot.fetchedAt),
      });

    // Roll up today's forecast total so the history chart has something to plot
    // even before we accumulate weeks of data.
    const today = snapshot.daily[0];
    if (today) {
      await database
        .collection(COLLECTIONS.rainfallDaily)
        .doc(phtDateKey(startedAt))
        .set(
          {
            date: today.date,
            totalMm: today.precipitationSumMm,
            precipitationHours: today.precipitationHours,
            maxWarningReached: snapshot.pagasaWarning,
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );
    }

    await database
      .collection(COLLECTIONS.config)
      .doc('systemHealth')
      .set(
        {
          lastRainfallFetch: {
            ok: true,
            at: Timestamp.fromDate(startedAt),
            error: null,
          },
        },
        { merge: true },
      );

    return Response.json({
      ok: true,
      currentMmHr: snapshot.current.precipitationMmHr,
      intensity: snapshot.intensityClass,
      pagasaWarning: snapshot.pagasaWarning,
      maxNext3hMm: snapshot.maxNext3hMm,
      next24hTotalMm: snapshot.next24hTotalMm,
      riverDischargeCms: snapshot.riverDischargeCms,
      hourlyPoints: snapshot.hourly.length,
      durationMs: Date.now() - startedAt.getTime(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await db()
      .collection(COLLECTIONS.config)
      .doc('systemHealth')
      .set(
        { lastRainfallFetch: { ok: false, at: Timestamp.fromDate(startedAt), error: message } },
        { merge: true },
      )
      .catch(() => {});

    console.error(`[poll-rainfall] FAILED: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}

export const GET = POST;
