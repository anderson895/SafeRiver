import { verifyToken, makeToken } from '@/lib/email/tokens';
import { confirmSubscriber, getSubscriber } from '@/lib/email/subscriberRepository';
import { renderWelcome } from '@/lib/email/templates';
import { sendAlertEmail } from '@/lib/email/transport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Step two of double opt-in.
 *
 * Idempotent: following the link twice is a no-op rather than an error, since
 * mail clients routinely prefetch links and a user may simply click again.
 */
export async function GET(req: Request) {
  const now = new Date();
  const token = new URL(req.url).searchParams.get('token');
  const result = verifyToken('confirm', token, now);

  if (!result.valid) {
    return Response.json({ ok: false, reason: result.reason }, { status: 400 });
  }

  try {
    const outcome = await confirmSubscriber(result.subscriberId!, now);
    if (outcome === 'not-found') {
      return Response.json({ ok: false, reason: 'not-found' }, { status: 404 });
    }

    // Send the welcome only on the transition, never on a replayed click.
    if (outcome === 'confirmed') {
      const sub = await getSubscriber(result.subscriberId!);
      if (sub) {
        const unsubscribeUrl = `${SITE}/unsubscribe?token=${makeToken('unsubscribe', sub.id, now)}`;
        const mail = renderWelcome(sub.language, unsubscribeUrl);
        await sendAlertEmail({
          to: sub.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          unsubscribeUrl,
        }).catch((err) => {
          // A failed welcome must not undo a successful confirmation.
          console.error(`[confirm] welcome email failed: ${(err as Error).message}`);
        });
      }
    }

    return Response.json({ ok: true, outcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/subscribe/confirm] ${message}`);
    return Response.json({ ok: false, reason: 'error' }, { status: 500 });
  }
}
