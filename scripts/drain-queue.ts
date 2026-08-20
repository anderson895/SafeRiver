/**
 * Drains the alert email queue.
 *
 *   npm run alerts:send
 *   BASE_URL=https://safe-river-san-manuel.vercel.app npm run alerts:send
 *
 * Publishing an advisory only QUEUES it — the fan-out is a separate, paginated
 * step so a large subscriber list cannot exceed Vercel's function limit. In
 * production the GitHub Actions workflow calls the dispatcher every 30 minutes.
 * Nothing plays that role on a development machine, so a locally published
 * advisory sits at QUEUED indefinitely and looks like a delivery failure. This
 * is that missing caller.
 *
 * Unlike `alert:test`, it fires no synthetic alert — it only sends what is
 * already waiting.
 */
// Marks this file a module. Without it TypeScript treats a script with no
// imports or exports as global scope, and its `BASE_URL` and `main` collide
// with the identically named ones in fire-test-alert.ts.
export {};

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

async function dispatch(): Promise<Record<string, unknown>> {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET is not set — run via npm so .env.local is loaded');

  const res = await fetch(`${BASE_URL}/api/cron/dispatch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(90_000),
  });

  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`dispatch returned non-JSON (HTTP ${res.status}): ${text.slice(0, 160)}`);
  }
  if (!res.ok || body.ok === false) {
    throw new Error(`dispatch failed: ${body.error ?? `HTTP ${res.status}`}`);
  }
  return body;
}

async function main() {
  console.log(`Target: ${BASE_URL}`);

  if (process.env.ALERTS_ENABLED !== 'true') {
    console.log('\nALERTS_ENABLED is not "true". The dispatcher will return');
    console.log('immediately and the queue will stay exactly as it is.\n');
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // The dispatcher returns hasMore when it stops at its deadline mid-job, or
  // when further jobs are still queued behind the one it just finished.
  for (let i = 1; i <= 20; i += 1) {
    process.stdout.write(`Pass ${i}... `);
    const r = await dispatch();
    sent += Number(r.sent ?? 0);
    skipped += Number(r.skipped ?? 0);
    failed += Number(r.failed ?? 0);
    console.log(
      `sent=${r.sent} skipped=${r.skipped} failed=${r.failed}` + (r.reason ? ` (${r.reason})` : ''),
    );
    if (!r.hasMore) break;
  }

  console.log(`\nTotal: ${sent} sent, ${skipped} skipped, ${failed} failed`);

  if (sent === 0) {
    console.log('\nNothing sent. Usual reasons:');
    console.log('  - ALERTS_ENABLED is not "true"');
    console.log('  - the queue was already empty');
    console.log('  - no ACTIVE subscribers, or they hit their daily cap');
    console.log('  - "alert missing": jobs left over from `alerts:reset`, whose');
    console.log('    alert documents are gone. They are marked FAILED as they');
    console.log('    are reached, so re-running clears them.');
    console.log('\nRun `npm run db:status` to see the queue and subscribers.');
  }
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
