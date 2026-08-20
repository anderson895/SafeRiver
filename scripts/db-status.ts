/**
 * Prints what is currently stored in Firestore. Handy for checking that the
 * scheduled scrape is actually accumulating history.
 *
 *   npm run db:status
 */
import { db, COLLECTIONS } from '../src/lib/firebase/admin';
import { getDamHistory } from '../src/lib/firebase/damRepository';
import { AGNO_DAM_IDS } from '../src/lib/scrape/damRegistry';

async function main() {
  const database = db();

  console.log('=== collection sizes ===');
  for (const name of [
    COLLECTIONS.damReadings,
    COLLECTIONS.damLatest,
    COLLECTIONS.damDaily,
    COLLECTIONS.alerts,
    COLLECTIONS.subscribers,
  ]) {
    const { count } = (await database.collection(name).count().get()).data();
    console.log(`  ${name.padEnd(14)} ${count}`);
  }

  console.log('\n=== Agno cascade (damLatest) ===');
  for (const id of AGNO_DAM_IDS) {
    const snap = await database.collection(COLLECTIONS.damLatest).doc(id).get();
    if (!snap.exists) {
      console.log(`  ${id.padEnd(10)} (no data)`);
      continue;
    }
    const d = snap.data()!;
    const pct = d.rwl != null && d.nhwl ? ((d.rwl / d.nhwl) * 100).toFixed(1) + '% of NHWL' : '';
    console.log(
      `  ${String(d.damName).padEnd(14)} RWL=${String(d.rwl).padStart(7)}  NHWL=${String(d.nhwl).padStart(6)}` +
        `  gates=${String(d.gatesOpen ?? '-').padStart(3)}  outflow=${String(d.outflowCms ?? '-').padStart(8)}` +
        `  ${String(d.trend).padEnd(7)}  ${pct}`,
    );
    console.log(`  ${''.padEnd(14)} observed ${d.observedAt?.toDate?.().toISOString()}`);
  }

  console.log('\n=== daily rollups (history depth) ===');
  for (const id of AGNO_DAM_IDS) {
    const rows = await getDamHistory(id, 5);
    const dates = rows.map((r) => r.date as string);
    console.log(`  ${id.padEnd(10)} ${rows.length} day(s): ${dates.join(', ') || '(none)'}`);
  }

  const health = await database.collection(COLLECTIONS.config).doc('systemHealth').get();
  if (health.exists) {
    const h = health.data()!;
    console.log('\n=== system health ===');
    console.log('  lastDamScrape:', JSON.stringify({
      ok: h.lastDamScrape?.ok,
      at: h.lastDamScrape?.at?.toDate?.().toISOString(),
      damsParsed: h.lastDamScrape?.damsParsed,
      error: h.lastDamScrape?.error,
    }));
    console.log('  consecutiveScrapeFailures:', h.consecutiveScrapeFailures ?? 0);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
