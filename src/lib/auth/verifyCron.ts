import 'server-only';
import { timingSafeEqual } from 'node:crypto';

/**
 * Authenticates scheduled-job callers.
 *
 * The cron routes mutate state and can trigger outbound email, so they must not
 * be publicly invokable — an open endpoint would let anyone spam every
 * subscriber. Callers present `Authorization: Bearer <CRON_SECRET>`.
 *
 * Comparison is constant-time. A plain `===` on a secret leaks its length and
 * prefix through timing, which is a real (if slow) way to recover it.
 */
export type CronAuthResult = { ok: true } | { ok: false; status: 401 | 500; reason: string };

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyCronRequest(req: Request): CronAuthResult {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Fail closed: an unset secret must never mean "allow everyone".
    return { ok: false, status: 500, reason: 'CRON_SECRET is not configured' };
  }

  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());

  // Vercel signs its own cron invocations differently; accept that too so the
  // once-daily Vercel cron can act as a redundant trigger alongside GitHub Actions.
  const vercelCron = req.headers.get('x-vercel-signature');
  if (!match && vercelCron && safeEqual(vercelCron, expected)) return { ok: true };

  if (!match) return { ok: false, status: 401, reason: 'Missing bearer token' };
  if (!safeEqual(match[1], expected)) return { ok: false, status: 401, reason: 'Invalid token' };

  return { ok: true };
}

/** Convenience wrapper returning a ready-to-send 401/500, or null when authorised. */
export function cronGuard(req: Request): Response | null {
  const result = verifyCronRequest(req);
  if (result.ok) return null;
  return Response.json({ ok: false, error: result.reason }, { status: result.status });
}
