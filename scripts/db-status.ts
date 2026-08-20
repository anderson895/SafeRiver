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

  console.log('\n=== subscribers ===');
  const subs = await database.collection(COLLECTIONS.subscribers).get();
  if (subs.empty) {
    console.log('  (none)');
  } else {
    const byStatus = new Map<string, number>();
    for (const d of subs.docs) {
      const s = (d.get('status') as string) ?? 'UNKNOWN';
      byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
    }
    for (const [status, n] of byStatus) console.log(`  ${status.padEnd(14)} ${n}`);
    for (const d of subs.docs) {
      // Show only the masked address; these are personal data under RA 10173.
      const email = (d.get('email') as string) ?? '';
      const masked = email.replace(/^(.).*(@.*)$/, '$1***$2');
      console.log(
        `    ${masked.padEnd(24)} ${String(d.get('status')).padEnd(12)} lang=${d.get('language')} ` +
          `sentToday=${d.get('emailsToday') ?? 0}`,
      );
    }
  }

  console.log('\n=== email queue ===');
  const jobs = await database.collection(COLLECTIONS.emailJobs).get();
  if (jobs.empty) console.log('  (no jobs)');
  for (const j of jobs.docs) {
    console.log(
      `  ${j.id.slice(0, 8)} ${String(j.get('status')).padEnd(8)} sent=${j.get('sentCount') ?? 0} failed=${j.get('failedCount') ?? 0}`,
    );
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
