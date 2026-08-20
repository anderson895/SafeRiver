import { z } from 'zod';
import { upsertPending } from '@/lib/email/subscriberRepository';
import { isPlausibleEmail, makeToken } from '@/lib/email/tokens';
import { renderConfirmation } from '@/lib/email/templates';
import { sendAlertEmail } from '@/lib/email/transport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  email: z.string().min(3).max(254),
  language: z.enum(['en', 'tl']).default('en'),
  barangay: z.string().max(80).nullable().optional(),
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Step one of double opt-in: record a PENDING subscriber and email a
 * confirmation link. Nothing is sent to this address again until the link is
 * followed.
 *
 * Double opt-in is doing two jobs here. It is the consent record RA 10173
 * requires, and it is the main reason Gmail will keep delivering these alerts
 * — every recipient demonstrably asked for them.
 */
export async function POST(req: Request) {
  const now = new Date();

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ ok: false, error: 'Invalid request' }, { status: 400 });
    }

    const email = parsed.data.email.trim();
    if (!isPlausibleEmail(email)) {
      return Response.json({ ok: false, error: 'Please enter a valid email address' }, { status: 400 });
    }

    const consent = {
      // Vercel puts the client address in x-forwarded-for.
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
    };

    const { id, alreadyActive } = await upsertPending(
      email,
      parsed.data.language,
      parsed.data.barangay ?? null,
      consent,
      now,
    );

    if (!alreadyActive) {
      const url = `${SITE}/subscribe/confirm?token=${makeToken('confirm', id, now)}`;
      const mail = renderConfirmation(url, parsed.data.language);
      await sendAlertEmail({
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        unsubscribeUrl: `${SITE}/unsubscribe?token=${makeToken('unsubscribe', id, now)}`,
      });
    }

    // Deliberately identical response whether or not the address was already
    // subscribed: a differing reply would let anyone test membership.
    return Response.json({
      ok: true,
      message: 'Check your inbox for a confirmation link.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/subscribe] ${message}`);
    return Response.json(
      { ok: false, error: 'Could not process the subscription. Please try again later.' },
      { status: 500 },
    );
  }
}
