/**
 * Phase 0, Risk Spike D — proves Nodemailer + Gmail SMTP works.
 *
 *   npx tsx --env-file=.env.local scripts/smoke-email.ts            # verify creds only
 *   npx tsx --env-file=.env.local scripts/smoke-email.ts --send     # also send one test email
 *
 * Sends only to ADMIN_ALERT_EMAIL (your own inbox). Check whether it lands in
 * Inbox or Spam — that result is a genuine finding for the thesis.
 */
import { verifyTransport, sendAlertEmail, readMailEnv } from '../src/lib/email/transport';

async function main() {
  const env = readMailEnv();
  console.log(`SMTP host : ${env.host}:${env.port}`);
  console.log(`SMTP user : ${env.user}`);
  console.log(`From      : "${env.fromName}" <${env.fromAddress}>`);
  console.log(`App pass  : ${env.pass.length} chars (Gmail app passwords are 16)\n`);

  process.stdout.write('Verifying SMTP credentials... ');
  await verifyTransport();
  console.log('OK — Gmail accepted the App Password.\n');

  if (!process.argv.includes('--send')) {
    console.log('Credentials valid. Re-run with --send to deliver a test alert.');
    return;
  }

  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) throw new Error('ADMIN_ALERT_EMAIL not set in .env.local');

  // Mirrors the real alert shape: bilingual subject, plaintext + HTML,
  // and a working one-click unsubscribe link.
  const unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/unsubscribe?token=SMOKE-TEST`;
  const subject = '[PAGSUBOK/TEST] San Roque Dam — 2,700 CMS na pagpapakawala ng tubig';

  const text = [
    'PAGSUBOK LAMANG ITO / THIS IS ONLY A TEST',
    '',
    'BABALA: Pagpapakawala ng tubig sa San Roque Dam',
    'Antas ng tubig (RWL): 279.40 m (NHWL: 280.00 m)',
    'Bukas na gate: 3 | Outflow: 2,700 CMS',
    '',
    'WARNING: Water release at San Roque Dam',
    'Reservoir water level: 279.40 m (NHWL: 280.00 m)',
    'Gates open: 3 | Outflow: 2,700 CMS',
    '',
    'Manatiling alerto. Iwasan ang mga lugar na malapit sa Agno River.',
    'Stay alert. Avoid areas near the Agno River.',
    '',
    `Mag-unsubscribe / Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f6f8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;font:15px/1.6 system-ui,-apple-system,sans-serif;color:#1a1a1a">
  <tr><td style="background:#E64A19;color:#fff;padding:16px 20px;font-weight:700;font-size:16px">
    &#9888; BABALA / WARNING &mdash; Pagpapakawala ng Tubig
  </td></tr>
  <tr><td style="padding:20px">
    <p style="margin:0 0 4px;color:#b26a00;font-weight:700">PAGSUBOK LAMANG ITO / THIS IS ONLY A TEST</p>
    <p style="margin:12px 0 4px"><strong>San Roque Dam</strong> &mdash; San Manuel, Pangasinan</p>
    <table role="presentation" cellpadding="6" style="border-collapse:collapse;margin:12px 0;font-size:14px">
      <tr><td style="color:#555">Antas ng tubig / Water level</td><td><strong>279.40 m</strong> <span style="color:#777">(NHWL 280.00 m)</span></td></tr>
      <tr><td style="color:#555">Bukas na gate / Gates open</td><td><strong>3</strong></td></tr>
      <tr><td style="color:#555">Outflow</td><td><strong>2,700 CMS</strong></td></tr>
    </table>
    <p style="margin:12px 0 0">Manatiling alerto at iwasan ang mga lugar malapit sa Agno River.<br>
    <span style="color:#555">Stay alert and avoid areas near the Agno River.</span></p>
  </td></tr>
  <tr><td style="padding:14px 20px;background:#fafafa;font-size:12px;color:#666">
    Pinagmulan / Source: PAGASA Dam Bulletin.<br>
    <a href="${unsubscribeUrl}" style="color:#1565C0">Mag-unsubscribe / Unsubscribe</a>
  </td></tr>
</table></td></tr></table></body></html>`;

  process.stdout.write(`Sending test alert to ${to}... `);
  const info = await sendAlertEmail({ to, subject, html, text, unsubscribeUrl });
  console.log('sent.');
  console.log(`  messageId : ${info.messageId}`);
  console.log(`  response  : ${info.response}`);
  console.log(`  accepted  : ${JSON.stringify(info.accepted)}`);
  if (info.rejected?.length) console.log(`  REJECTED  : ${JSON.stringify(info.rejected)}`);
  console.log(`\nNow check ${to} — note whether it landed in Inbox or Spam.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\nFAILED: ${err.message}`);
    if (/Invalid login|BadCredentials|535/.test(String(err.message))) {
      console.error(
        '\nGmail rejected the credentials. Checklist:\n' +
          '  1. 2-Step Verification must be ON for the account.\n' +
          '  2. SMTP_PASS must be an App Password (16 chars), not the account password.\n' +
          '  3. SMTP_USER must be the full address, e.g. you@gmail.com.',
      );
    }
    process.exit(1);
  });
