import { verifyToken } from '@/lib/email/tokens';
import { unsubscribe } from '@/lib/email/subscriberRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(token: string | null) {
  const now = new Date();
  const result = verifyToken('unsubscribe', token, now);
  if (!result.valid) {
    return Response.json({ ok: false, reason: result.reason }, { status: 400 });
  }

  try {
    const outcome = await unsubscribe(result.subscriberId!, now);
    // Report success even when the record is gone: the caller's intent — stop
    // receiving mail — is satisfied either way.
    return Response.json({ ok: true, outcome });
  } catch (err) {
    console.error(`[api/unsubscribe] ${(err as Error).message}`);
    return Response.json({ ok: false, reason: 'error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(new URL(req.url).searchParams.get('token'));
}

/**
 * One-click unsubscribe.
 *
 * Gmail and other bulk receivers POST here directly from the
 * `List-Unsubscribe-Post` header without ever loading a page, so this must
 * work with no UI and no confirmation step. Honouring it promptly is a large
 * part of why mail from this sender keeps reaching the inbox.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  let token = url.searchParams.get('token');

  if (!token) {
    // Some clients send the token in a form body instead of the query string.
    const body = await req.text().catch(() => '');
    token = new URLSearchParams(body).get('token');
  }

  return handle(token);
}
