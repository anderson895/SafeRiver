import * as cheerio from 'cheerio';
import { z } from 'zod';
import { buildTableGrid, buildHeaderMap } from './tableGrid';
import { matchDam, type DamId } from './damRegistry';

export const PAGASA_FLOOD_URL = process.env.PAGASA_FLOOD_URL ?? 'https://www.pagasa.dost.gov.ph/flood';

/** PAGASA publishes in Philippine Standard Time (UTC+8), with no offset in the markup. */
const PHT_OFFSET = '+08:00';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Coerces a scraped cell to a number.
 *
 * CRITICAL: an absent value MUST become `null`, never `0`. PAGASA leaves the
 * gate/outflow cells blank when a dam is not releasing, but it also leaves them
 * blank when it simply has not published them. Coercing either case to `0`
 * would read downstream as "outflow is zero, therefore safe" and would silently
 * suppress alerts. `null` forces callers to treat the value as unknown.
 */
export function toNum(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '' || /^(-|--|n\/?a|none|tbd)$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parses PAGASA's "Aug-20" + "08:00 AM" pair into an absolute instant. */
export function parseObservedAt(
  dateCell: string,
  timeCell: string,
  now: Date = new Date(),
): Date | null {
  const dateMatch = /([A-Za-z]{3,})[\s-]+(\d{1,2})(?:[\s,-]+(\d{4}))?/.exec(dateCell.trim());
  if (!dateMatch) return null;

  const month = MONTHS[dateMatch[1].slice(0, 3).toLowerCase()];
  const day = Number(dateMatch[2]);
  if (!month || !day) return null;

  let year = dateMatch[3] ? Number(dateMatch[3]) : now.getUTCFullYear();

  let hour = 0;
  let minute = 0;
  const timeMatch = /(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(timeCell.trim());
  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
    const mer = timeMatch[3]?.toLowerCase();
    if (mer === 'pm' && hour !== 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
  }

  const build = (y: number) =>
    new Date(
      `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` +
        `T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${PHT_OFFSET}`,
    );

  let d = build(year);
  if (Number.isNaN(d.getTime())) return null;

  // The bulletin omits the year. If assuming the current year lands us well in
  // the future, the reading must belong to the previous year (Dec/Jan rollover).
  if (!dateMatch[3] && d.getTime() - now.getTime() > 45 * 24 * 60 * 60 * 1000) {
    year -= 1;
    d = build(year);
  }
  return Number.isNaN(d.getTime()) ? null : d;
}

export const DamReadingSchema = z.object({
  damId: z.string(),
  damName: z.string().min(1),
  observedAt: z.date(),
  rwl: z.number().nullable(),
  rwlDeviation24h: z.number().nullable(),
  deviationHours: z.number().nullable(),
  nhwl: z.number().nullable(),
  deviationFromNhwl: z.number().nullable(),
  ruleCurve: z.number().nullable(),
  deviationFromRuleCurve: z.number().nullable(),
  gatesOpen: z.number().nullable(),
  gateOpeningM: z.number().nullable(),
  inflowCms: z.number().nullable(),
  outflowCms: z.number().nullable(),
  rawRow: z.array(z.string()),
});
export type DamReading = z.infer<typeof DamReadingSchema> & { damId: DamId };

export const BasinStatusSchema = z.object({
  name: z.string(),
  status: z.string(),
  isFloodWatch: z.boolean(),
});
export type BasinStatus = z.infer<typeof BasinStatusSchema>;

export interface ScrapeResult {
  readings: DamReading[];
  /** Official river-basin / sub-basin flood watch flags (bonus signal). */
  basins: BasinStatus[];
  agnoBasin: BasinStatus | null;
  agnoSubBasin: BasinStatus | null;
  scrapedAt: Date;
  sourceUrl: string;
}

/** Looks up a column by any of several candidate canonical names. */
function col(headers: Map<string, number>, ...candidates: string[]): number | null {
  for (const c of candidates) {
    const i = headers.get(c);
    if (i !== undefined) return i;
  }
  // Fall back to a prefix match so minor label edits by PAGASA don't break us.
  for (const c of candidates) {
    for (const [key, i] of headers) {
      if (key.startsWith(c) || key.includes(c)) return i;
    }
  }
  return null;
}

export function parsePagasaFlood(html: string, now: Date = new Date()): ScrapeResult {
  const $ = cheerio.load(html);

  // ---- Dam table -------------------------------------------------------
  let $damTable = $('table.dam-table').first();
  if ($damTable.length === 0) {
    // Fallback: the table whose header mentions "Dam Name".
    $damTable = $('table')
      .filter((_, t) => /dam\s*name/i.test($(t).find('tr').first().text()))
      .first();
  }
  if ($damTable.length === 0) {
    throw new Error('PAGASA parse failed: could not locate the dam table');
  }

  const grid = buildTableGrid($, $damTable);
  const headers = buildHeaderMap(grid, 2);

  const cName = col(headers, 'dam_name') ?? 0;
  const cObs = col(headers, 'observation_time_date', 'observation_time') ?? 1;
  const cRwl = col(headers, 'reservoir_water_level', 'reservoir_water_level_rwl');
  const cDevHr = col(headers, 'water_level_deviation_hr');
  const cDevAmt = col(headers, 'water_level_deviation_amount');
  const cNhwl = col(headers, 'normal_high_water_level');
  const cDevNhwl = col(headers, 'deviation_from_nhwl');
  const cRule = col(headers, 'rule_curve_elevation');
  const cDevRule = col(headers, 'deviation_from_rule_curve');
  const cGates = col(headers, 'gate_opening_gates');
  const cMeters = col(headers, 'gate_opening_meters');
  const cInflow = col(headers, 'estimated_inflow');
  const cOutflow = col(headers, 'estimated_outflow');

  if (cRwl === null || cOutflow === null || cNhwl === null) {
    throw new Error(
      `PAGASA parse failed: required columns missing. Saw headers: ${[...headers.keys()].join(', ')}`,
    );
  }

  const at = (r: number, c: number | null) => (c === null ? '' : (grid[r]?.[c] ?? ''));

  const readings: DamReading[] = [];
  const seen = new Set<DamId>();

  for (let r = 2; r < grid.length; r += 1) {
    const dam = matchDam(at(r, cName));
    if (!dam || seen.has(dam.id)) continue;

    // A dam block's first row carries the time; the *next* row carries the date
    // in the same "Observation Time & Date" column.
    const timeCell = at(r, cObs);
    if (!/\d{1,2}:\d{2}/.test(timeCell)) continue;
    const dateCell = at(r + 1, cObs);

    const observedAt = parseObservedAt(dateCell, timeCell, now);
    if (!observedAt) continue;

    seen.add(dam.id);
    readings.push({
      damId: dam.id,
      damName: dam.name,
      observedAt,
      rwl: toNum(at(r, cRwl)),
      rwlDeviation24h: toNum(at(r, cDevAmt)),
      deviationHours: toNum(at(r, cDevHr)),
      nhwl: toNum(at(r, cNhwl)),
      deviationFromNhwl: toNum(at(r, cDevNhwl)),
      ruleCurve: toNum(at(r, cRule)),
      deviationFromRuleCurve: toNum(at(r, cDevRule)),
      gatesOpen: toNum(at(r, cGates)),
      gateOpeningM: toNum(at(r, cMeters)),
      inflowCms: toNum(at(r, cInflow)),
      outflowCms: toNum(at(r, cOutflow)),
      rawRow: grid[r] ?? [],
    });
  }

  // ---- Basin / sub-basin flood watch status ----------------------------
  const basins: BasinStatus[] = [];
  $('table').each((_, t) => {
    const $t = $(t);
    if (!/river\s*basins|sub\s*basin/i.test($t.text())) return;
    const g = buildTableGrid($, $t);
    for (const row of g) {
      const name = (row[0] ?? '').trim();
      const status = (row[1] ?? '').trim();
      if (!name || !status) continue;
      if (!/flood\s*watch/i.test(status)) continue;
      basins.push({
        name,
        status,
        // "Non-Flood Watch" must not match as a flood watch.
        isFloodWatch: /^(?!non)/i.test(status) && /^flood\s*watch/i.test(status),
      });
    }
  });

  const find = (re: RegExp) => basins.find((b) => re.test(b.name)) ?? null;

  return {
    readings,
    basins,
    agnoBasin: find(/^agno$/i),
    agnoSubBasin: find(/ambuklao.*binga.*san\s*roque/i),
    scrapedAt: now,
    sourceUrl: PAGASA_FLOOD_URL,
  };
}

/** Fetches and parses the live PAGASA flood page. */
export async function fetchPagasaFlood(now: Date = new Date()): Promise<ScrapeResult> {
  const res = await fetch(PAGASA_FLOOD_URL, {
    headers: {
      // Identify ourselves — we are a polite, low-volume consumer of a public page.
      'User-Agent': 'SanManuelFloodInfo/1.0 (undergraduate thesis; flood advisory relay)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`PAGASA fetch failed: HTTP ${res.status} ${res.statusText}`);
  return parsePagasaFlood(await res.text(), now);
}
