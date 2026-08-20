/**
 * Fires a synthetic alert through the real pipeline and drains the email queue.
 *
 *   npm run alert:test                 # against localhost:3000
 *   npm run alert:test -- --severity WATCH
 *   BASE_URL=https://safe-river-san-manuel.vercel.app npm run alert:test
 *
 * Exists so the end-to-end path can be exercised without waiting for the Agno
 * to flood — and so a live alert can be demonstrated at the thesis defense
 * regardless of the weather that day.
 *
 * Reads CRON_SECRET from .env.local rather than taking it on the command line,
 * so the secret never lands in shell history. It also avoids the curl/-H
 * incompatibility in PowerShell, where `curl` is an alias for Invoke-WebRequest.
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function call(path: string): Promise<Record<string, unknown>> {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET is not set — run via npm so .env.local is loaded');

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(90_000),
  });

  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON (HTTP ${res.status}): ${text.slice(0, 160)}`);
  }
  if (!res.ok || body.ok === false) {
    throw new Error(`${path} failed: ${body.error ?? `HTTP ${res.status}`}`);
  }
  return body;
}

async function main() {
  const severity = arg('severity', 'WARNING').toUpperCase();
  console.log(`Target: ${BASE_URL}`);

  if (process.env.ALERTS_ENABLED !== 'true') {
    console.log('\nNOTE: ALERTS_ENABLED is not "true", so the dispatcher will');
    console.log('      queue the alert but send no email. Set it in .env.local');
    console.log('      to deliver for real.\n');
  }

  process.stdout.write(`Firing synthetic ${severity} alert... `);
  const fired = await call(`/api/cron/test-alert?severity=${severity}`);
  console.log('queued.');
  console.log(`  alertId: ${fired.alertId}`);
  console.log(`  jobId  : ${fired.jobId}`);

  // The dispatcher returns hasMore when it hits its deadline mid-job; keep
  // calling until the queue reports drained, exactly as CI does.
  let totalSent = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (let i = 1; i <= 20; i += 1) {
    process.stdout.write(`Dispatch pass ${i}... `);
    const r = await call('/api/cron/dispatch');
    totalSent += Number(r.sent ?? 0);
    totalSkipped += Number(r.skipped ?? 0);
    totalFailed += Number(r.failed ?? 0);
    console.log(
      `sent=${r.sent} skipped=${r.skipped} failed=${r.failed}` +
        (r.reason ? ` (${r.reason})` : ''),
    );
    if (!r.hasMore) break;
  }

  console.log(`\nTotal: ${totalSent} sent, ${totalSkipped} skipped, ${totalFailed} failed`);

  if (totalSent === 0) {
    console.log('\nNothing was sent. Usual reasons:');
    console.log('  - ALERTS_ENABLED is not "true"');
    console.log('  - no ACTIVE subscribers (subscribe, then click the confirm link)');
    console.log('  - the subscriber already hit their daily cap');
  } else {
    console.log('\nCheck the inbox. The message is clearly marked as a test.');
  }
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
