import { cronGuard } from '@/lib/auth/verifyCron';
import { dispatchOnce } from '@/lib/email/dispatcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Drains one slice of the alert email queue.
 *
 * The GitHub Actions workflow calls this repeatedly while `hasMore` is true.
 * The loop lives there rather than here because a function that self-invokes
 * via fetch can be killed by the platform when the parent returns — and
 * because the Actions log then doubles as a free record of every dispatch,
 * which is useful evidence for the thesis appendix.
 */
export async function POST(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;

  try {
    const result = await dispatchOnce(new Date());
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron/dispatch] ${message}`);
    // Report hasMore:false on error so the Actions loop stops rather than
    // hammering a broken dispatcher for twenty iterations.
    return Response.json({ ok: false, error: message, hasMore: false }, { status: 500 });
  }
}

export const GET = POST;
