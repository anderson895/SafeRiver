/**
 * Phase 0, Risk Spike A — proves the PAGASA scraper works end to end.
 * Runs against the committed fixture, then optionally against the live page.
 *
 *   npx tsx scripts/smoke-scrape.ts          # fixture only
 *   npx tsx scripts/smoke-scrape.ts --live   # also hit pagasa.dost.gov.ph
 */
import { readFileSync } from 'node:fs';
import { parsePagasaFlood, fetchPagasaFlood, DamReadingSchema, type ScrapeResult } from '../src/lib/scrape/pagasaDams';
import { AGNO_DAM_IDS } from '../src/lib/scrape/damRegistry';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function report(source: string, result: ScrapeResult) {
  console.log(`\n${'='.repeat(72)}\n${source}\n${'='.repeat(72)}`);
  console.log(`Parsed ${result.readings.length} dams at ${result.scrapedAt.toISOString()}\n`);

  for (const r of result.readings) {
    const agno = AGNO_DAM_IDS.includes(r.damId) ? ' <-- AGNO' : '';
    console.log(
      `  ${r.damName.padEnd(18)} RWL=${String(r.rwl).padStart(7)}  NHWL=${String(r.nhwl).padStart(7)}` +
        `  dev24h=${String(r.rwlDeviation24h).padStart(6)}  gates=${String(r.gatesOpen).padStart(4)}` +
        `  outflow=${String(r.outflowCms).padStart(8)}  @ ${r.observedAt.toISOString()}${agno}`,
    );
  }

  console.log('\n  Basin status:');
  console.log(`    Agno basin          : ${result.agnoBasin?.status ?? 'NOT FOUND'}`);
  console.log(`    Ambuklao-Binga-SR   : ${result.agnoSubBasin?.status ?? 'NOT FOUND'}`);

  console.log('\n  Assertions:');
  check('found all 3 Agno dams', AGNO_DAM_IDS.every((id) => result.readings.some((r) => r.damId === id)));

  const sr = result.readings.find((r) => r.damId === 'san-roque');
  check('San Roque present', !!sr);
  check('San Roque NHWL = 280 (plan threshold)', sr?.nhwl === 280, `got ${sr?.nhwl}`);
  check('San Roque RWL is a number', typeof sr?.rwl === 'number', `got ${sr?.rwl}`);
  check('observedAt is a valid date', !!sr && !Number.isNaN(sr.observedAt.getTime()));

  // The null-vs-zero trap: blank cells must be null, never 0.
  const blanks = result.readings.filter((r) => r.outflowCms === null);
  check('blank outflow cells parse as null (never 0)', blanks.length > 0, `${blanks.length} dams with null outflow`);
  const zeroed = result.readings.filter((r) => r.outflowCms === 0);
  check('no blank cell silently became 0', zeroed.length === 0, `${zeroed.length} dams reported exactly 0`);

  // Dams that ARE releasing must have real numbers.
  const releasing = result.readings.filter((r) => (r.gatesOpen ?? 0) > 0);
  check('releasing dams have outflow values', releasing.every((r) => typeof r.outflowCms === 'number'),
    releasing.map((r) => `${r.damName}=${r.outflowCms}`).join(', ') || 'none releasing');

  // Every reading must satisfy the Zod contract used by the cron route.
  const bad = result.readings.filter((r) => !DamReadingSchema.safeParse(r).success);
  check('all readings pass Zod schema', bad.length === 0, bad.map((b) => b.damName).join(', '));
}

async function main() {
  const html = readFileSync('src/lib/scrape/__fixtures__/pagasa-flood.html', 'utf8');
  report('FIXTURE  src/lib/scrape/__fixtures__/pagasa-flood.html', parsePagasaFlood(html));

  if (process.argv.includes('--live')) {
    try {
      report('LIVE  https://www.pagasa.dost.gov.ph/flood', await fetchPagasaFlood());
    } catch (err) {
      console.log(`\n  FAIL  live fetch threw: ${(err as Error).message}`);
      failures += 1;
    }
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
