/**
 * Runs the data pollers once, immediately.
 *
 *   npm run poll
 *   BASE_URL=https://safe-river-san-manuel.vercel.app npm run poll
 *
 * These are the same endpoints the GitHub Actions workflow calls every 30
 * minutes. On a fresh clone Firestore is empty and every data page reads "no
 * data" until they have run at least once, so this is part of first-time setup
 * as well as a way to force a refresh without waiting for the schedule.
 *
 * Deliberately separate from `alert:test`, which fires a SYNTHETIC reading —
 * useful for exercising the alert path, useless for populating real data.
 *
 * Reads CRON_SECRET from .env.local so the secret never lands in shell history,
 * and avoids PowerShell's `curl` alias for Invoke-WebRequest, which rejects -H.
 */
export {};

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

async function post(path: string): Promise<Record<string, unknown>> {
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
  console.log(`Target: ${BASE_URL}\n`);

  // Rainfall runs even if the dam scrape fails: PAGASA changing their HTML must
  // not also take out the rainfall feed, which has a different source entirely.
  let failed = false;

  for (const [label, path] of [
    ['Dams    ', '/api/cron/poll-dams'],
    ['Rainfall', '/api/cron/poll-rainfall'],
  ] as const) {
    process.stdout.write(`${label} ... `);
    try {
      const r = await post(path);
      const detail = Object.entries(r)
        .filter(([k]) => k !== 'ok')
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ');
      console.log(`ok  ${detail}`);
    } catch (err) {
      failed = true;
      console.log(`FAILED: ${(err as Error).message}`);
    }
  }

  console.log('\nRun `npm run db:status` to see what landed.');
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
