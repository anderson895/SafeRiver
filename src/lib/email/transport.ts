import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Nodemailer transport for Gmail SMTP.
 *
 * Tuned to be SLOW ON PURPOSE. Gmail is far stricter than a dedicated relay
 * about bursts of near-identical mail: exceeding its tolerance gets the sending
 * account temporarily locked, which would take the whole alert channel offline
 * exactly when it is needed. Throughput is irrelevant here — a flood alert
 * reaching 300 people over 60 seconds is fine; the account being blocked is not.
 *
 * SMTP_PASS must be a Google *App Password* (requires 2FA), never the account
 * password.
 */

/** Free Gmail allows ~500 recipients/24h. We stop well short so we never trip it. */
export const DAILY_SEND_CEILING = 400;

/** Per-subscriber cap, so a runaway alert rule degrades to silence, not to spam. */
export const MAX_EMAILS_PER_SUBSCRIBER_PER_DAY = 6;

let cached: Transporter | null = null;

export interface MailEnv {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromAddress: string;
}

export function readMailEnv(): MailEnv {
  const {
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
    MAIL_FROM_NAME, MAIL_FROM_ADDRESS,
  } = process.env;

  const missing = Object.entries({ SMTP_HOST, SMTP_USER, SMTP_PASS })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`Email not configured — missing ${missing.join(', ')} (see .env.example)`);
  }

  return {
    host: SMTP_HOST!,
    port: Number(SMTP_PORT ?? 587),
    user: SMTP_USER!,
    pass: SMTP_PASS!.replace(/\s+/g, ''), // Google displays app passwords in groups of 4
    fromName: (MAIL_FROM_NAME ?? 'San Manuel Flood Information System').replace(/^"|"$/g, ''),
    fromAddress: MAIL_FROM_ADDRESS ?? SMTP_USER!,
  };
}

export function getTransport(): Transporter {
  if (cached) return cached;
  const env = readMailEnv();

  cached = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.port === 465, // 587 uses STARTTLS, which nodemailer negotiates automatically
    auth: { user: env.user, pass: env.pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    rateDelta: 1000,
    rateLimit: 5,
  });

  return cached;
}

export function fromHeader(env = readMailEnv()): string {
  return `"${env.fromName}" <${env.fromAddress}>`;
}

export interface AlertMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Absolute URL carrying the recipient's single-use unsubscribe token. */
  unsubscribeUrl: string;
}

/**
 * Sends one message to one recipient.
 *
 * Always one recipient per call — never BCC. Each subscriber needs their own
 * unsubscribe token, and a BCC blast is both the strongest bulk-spam signal to
 * Gmail and a disclosure of every subscriber's address to every other
 * subscriber (RA 10173 problem).
 */
export async function sendAlertEmail(input: AlertMailInput) {
  const env = readMailEnv();
  return getTransport().sendMail({
    from: fromHeader(env),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    headers: {
      // One-click unsubscribe. Gmail effectively requires this from bulk senders.
      'List-Unsubscribe': `<${input.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'Auto-Submitted': 'auto-generated',
    },
  });
}

/** Verifies SMTP credentials without sending anything. */
export async function verifyTransport(): Promise<true> {
  await getTransport().verify();
  return true;
}
