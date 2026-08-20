import { z } from 'zod';

/**
 * Open-Meteo clients for rainfall and river discharge.
 *
 * Chosen over OpenWeatherMap/WeatherAPI because it needs no API key, allows
 * CORS, and permits ~10k requests/day free — we use 48. Two separate services:
 *   forecast API  -> hourly precipitation at San Manuel
 *   flood API     -> GloFAS v4 river discharge, the only free *river* signal
 *                    available for the Agno (PAGASA publishes reservoir levels,
 *                    not river stage at the municipality).
 */

export const SAN_MANUEL = {
  lat: Number(process.env.OPEN_METEO_LAT ?? 16.0708),
  lon: Number(process.env.OPEN_METEO_LON ?? 120.6647),
  name: 'San Manuel, Pangasinan',
} as const;

/** PAGASA's public rainfall warning scale, in mm/hr. */
export type PagasaWarning = 'NONE' | 'YELLOW' | 'ORANGE' | 'RED';
export type IntensityClass =
  | 'NONE' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'INTENSE' | 'TORRENTIAL';

export const RAINFALL_THRESHOLDS = {
  /** Yellow: flooding is possible in low-lying areas. */
  yellow: 7.5,
  /** Orange: flooding is threatening. */
  orange: 15,
  /** Red: serious flooding expected; evacuation may be required. */
  red: 30,
} as const;

export function classifyIntensity(mmPerHour: number | null): IntensityClass {
  if (mmPerHour == null || mmPerHour <= 0) return 'NONE';
  if (mmPerHour < 2.5) return 'LIGHT';
  if (mmPerHour < 7.5) return 'MODERATE';
  if (mmPerHour < 15) return 'HEAVY';
  if (mmPerHour <= 30) return 'INTENSE';
  return 'TORRENTIAL';
}

export function classifyPagasaWarning(mmPerHour: number | null): PagasaWarning {
  if (mmPerHour == null) return 'NONE';
  if (mmPerHour > RAINFALL_THRESHOLDS.red) return 'RED';
  if (mmPerHour > RAINFALL_THRESHOLDS.orange) return 'ORANGE';
  if (mmPerHour >= RAINFALL_THRESHOLDS.yellow) return 'YELLOW';
  return 'NONE';
}

const ForecastSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().optional(),
  current: z
    .object({
      time: z.string(),
      precipitation: z.number().nullable().optional(),
      rain: z.number().nullable().optional(),
      temperature_2m: z.number().nullable().optional(),
      weather_code: z.number().nullable().optional(),
      is_day: z.number().nullable().optional(),
    })
    .optional(),
  hourly: z.object({
    time: z.array(z.string()),
    precipitation: z.array(z.number().nullable()),
    precipitation_probability: z.array(z.number().nullable()).optional(),
  }),
  daily: z
    .object({
      time: z.array(z.string()),
      precipitation_sum: z.array(z.number().nullable()),
      precipitation_hours: z.array(z.number().nullable()).optional(),
    })
    .optional(),
});

const FloodSchema = z.object({
  daily: z.object({
    time: z.array(z.string()),
    river_discharge: z.array(z.number().nullable()),
  }),
});

export interface HourlyPoint {
  t: string;
  precipitationMm: number | null;
  probability: number | null;
}

export interface RainfallSnapshot {
  fetchedAt: Date;
  location: { lat: number; lon: number; name: string };
  current: {
    time: string | null;
    /** Sum of the preceding hour, comparable to the PAGASA mm/hr scale. */
    precipitationMmHr: number | null;
    /** Raw 15-minute figure from the API. Display only — do not classify. */
    last15MinMm: number | null;
    temperature: number | null;
    weatherCode: number | null;
    isDay: boolean | null;
  };
  hourly: HourlyPoint[];
  daily: { date: string; precipitationSumMm: number | null; precipitationHours: number | null }[];
  intensityClass: IntensityClass;
  pagasaWarning: PagasaWarning;
  /** Highest precipitation in the next 3 hours — the forward-looking signal. */
  maxNext3hMm: number | null;
  /** Total precipitation over the next 24 hours. */
  next24hTotalMm: number | null;
  riverDischargeCms: number | null;
  source: 'open-meteo';
}

async function getJson(url: string, timeoutMs = 15_000): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SanManuelFloodInfo/1.0 (undergraduate thesis)' },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status} ${res.statusText} for ${new URL(url).pathname}`);
  return res.json();
}

/**
 * River discharge for the Agno near San Manuel (GloFAS v4, ~5 km resolution).
 * Returns null rather than throwing — this is a supplementary signal, and a
 * flood API outage must not take down the rainfall poll.
 */
export async function fetchRiverDischarge(): Promise<number | null> {
  try {
    const url =
      `https://flood-api.open-meteo.com/v1/flood?latitude=${SAN_MANUEL.lat}` +
      `&longitude=${SAN_MANUEL.lon}&daily=river_discharge&forecast_days=1`;
    const parsed = FloodSchema.parse(await getJson(url));
    return parsed.daily.river_discharge[0] ?? null;
  } catch (err) {
    console.warn(`[rainfall] river discharge unavailable: ${(err as Error).message}`);
    return null;
  }
}

export async function fetchRainfall(now: Date = new Date()): Promise<RainfallSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${SAN_MANUEL.lat}&longitude=${SAN_MANUEL.lon}` +
    `&current=precipitation,rain,temperature_2m,weather_code,is_day` +
    `&hourly=precipitation,precipitation_probability` +
    `&daily=precipitation_sum,precipitation_hours` +
    `&timezone=Asia%2FManila&forecast_days=3`;

  const data = ForecastSchema.parse(await getJson(url));

  const hourly: HourlyPoint[] = data.hourly.time.map((t, i) => ({
    t,
    precipitationMm: data.hourly.precipitation[i] ?? null,
    probability: data.hourly.precipitation_probability?.[i] ?? null,
  }));

  // Open-Meteo returns the whole forecast window including past hours of today;
  // slice to the future so "next 3h" and "next 24h" mean what they say.
  const nowIso = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 13);
  const futureStart = Math.max(0, hourly.findIndex((h) => h.t.slice(0, 13) >= nowIso));
  const future = hourly.slice(futureStart);

  const nums = (xs: (number | null)[]) => xs.filter((n): n is number => n != null);
  const next3 = nums(future.slice(0, 3).map((h) => h.precipitationMm));
  const next24 = nums(future.slice(0, 24).map((h) => h.precipitationMm));

  /**
   * Hourly rate for the CURRENT hour, taken from the hourly series.
   *
   * NOT `current.precipitation`. Open-Meteo documents the `current` block as a
   * backward-looking sum over its `interval`, which is 900 s — fifteen minutes,
   * not an hour. Treating that as mm/hr understates rainfall four-fold, and
   * because the same figure was fed to the PAGASA classifier it moved every
   * threshold up by 4x: the Yellow band (7.5 mm/hr) would not have fired until
   * 30 mm/hr, and Red (30 mm/hr) not until 120 mm/hr. The observed-rainfall
   * alert path was effectively dead.
   *
   * `hourly.precipitation` is documented as the sum of the preceding hour, so
   * it is directly comparable to PAGASA's mm/hr scale.
   */
  const currentHourIndex = hourly.findIndex((h) => h.t.slice(0, 13) === nowIso);
  const observedMmHr =
    currentHourIndex >= 0 ? hourly[currentHourIndex].precipitationMm : null;

  /** The raw 15-minute figure, kept for display only — never classified. */
  const last15MinMm = data.current?.precipitation ?? data.current?.rain ?? null;

  return {
    fetchedAt: now,
    location: { lat: SAN_MANUEL.lat, lon: SAN_MANUEL.lon, name: SAN_MANUEL.name },
    current: {
      time: data.current?.time ?? null,
      precipitationMmHr: observedMmHr,
      last15MinMm,
      temperature: data.current?.temperature_2m ?? null,
      weatherCode: data.current?.weather_code ?? null,
      isDay: data.current?.is_day == null ? null : data.current.is_day === 1,
    },
    hourly: future.slice(0, 48),
    daily:
      data.daily?.time.map((date, i) => ({
        date,
        precipitationSumMm: data.daily!.precipitation_sum[i] ?? null,
        precipitationHours: data.daily!.precipitation_hours?.[i] ?? null,
      })) ?? [],
    intensityClass: classifyIntensity(observedMmHr),
    pagasaWarning: classifyPagasaWarning(observedMmHr),
    maxNext3hMm: next3.length ? Math.max(...next3) : null,
    next24hTotalMm: next24.length ? Number(next24.reduce((a, b) => a + b, 0).toFixed(2)) : null,
    riverDischargeCms: await fetchRiverDischarge(),
    source: 'open-meteo',
  };
}
