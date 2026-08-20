import type { Lang } from '@/i18n/lang';
import type { Severity } from '@/lib/alerts/types';
import { SEVERITY_COLORS } from '@/theme/theme';

/**
 * Email templates.
 *
 * Every message ships plaintext alongside HTML: it improves deliverability,
 * and on a weak rural connection the text part is what actually renders.
 * No image-only content, and no remote images at all — many clients block
 * them by default, which would leave an alert looking empty.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const BRAND = '#1565C0';

function shell(headerColor: string, headerText: string, inner: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f6f8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;font:15px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;color:#1a1a1a">
  <tr><td style="background:${headerColor};color:#fff;padding:16px 20px;font-weight:700;font-size:16px">${headerText}</td></tr>
  <tr><td style="padding:20px">${inner}</td></tr>
  <tr><td style="padding:14px 20px;background:#fafafa;font-size:12px;color:#666;line-height:1.5">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

// ---------------------------------------------------------------------------
export function renderConfirmation(confirmUrl: string, lang: Lang): Rendered {
  const t =
    lang === 'tl'
      ? {
          subject: 'Kumpirmahin ang inyong subscription sa babala ng baha',
          header: 'Kumpirmahin ang Subscription',
          lead: 'Salamat sa pag-sign up para sa mga babala tungkol sa baha at pagpapakawala ng tubig sa San Manuel, Pangasinan.',
          cta: 'Kumpirmahin ang Email',
          note: 'Kung hindi ikaw ang nag-sign up, huwag pansinin ang mensaheng ito. Walang ipapadalang babala hangga\'t hindi kumukumpirma.',
          expiry: 'Mag-e-expire ang link na ito sa loob ng 48 oras.',
          fallback: 'Kung ayaw gumana ng button, kopyahin ang link na ito:',
        }
      : {
          subject: 'Confirm your flood alert subscription',
          header: 'Confirm Your Subscription',
          lead: 'Thank you for signing up for flood and dam release alerts for San Manuel, Pangasinan.',
          cta: 'Confirm Email',
          note: 'If you did not sign up, please ignore this message. No alerts will be sent unless you confirm.',
          expiry: 'This link expires in 48 hours.',
          fallback: 'If the button does not work, copy this link:',
        };

  const html = shell(
    BRAND,
    t.header,
    `<p style="margin:0 0 16px">${t.lead}</p>
     <p style="margin:0 0 22px"><a href="${confirmUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">${t.cta}</a></p>
     <p style="margin:0 0 8px;font-size:13px;color:#555">${t.expiry}</p>
     <p style="margin:0;font-size:12px;color:#777">${t.fallback}<br><span style="word-break:break-all">${confirmUrl}</span></p>`,
    t.note,
  );

  const text = [t.header, '', t.lead, '', confirmUrl, '', t.expiry, '', t.note].join('\n');
  return { subject: t.subject, html, text };
}

// ---------------------------------------------------------------------------
export function renderWelcome(lang: Lang, unsubscribeUrl: string): Rendered {
  const t =
    lang === 'tl'
      ? {
          subject: 'Aktibo na ang inyong subscription sa babala ng baha',
          header: 'Aktibo na ang Subscription',
          lead: 'Makakatanggap na kayo ng babala kapag may pagpapakawala ng tubig sa San Roque Dam, tumaas ang lebel ng tubig, o may malakas na pag-ulan sa San Manuel.',
          sourceLine: 'Ang mga babala ay batay sa opisyal na PAGASA dam bulletin at datos ng pag-ulan.',
          visit: 'Tingnan ang mapa at kasalukuyang kalagayan',
          unsub: 'Mag-unsubscribe',
        }
      : {
          subject: 'Your flood alert subscription is active',
          header: 'Subscription Active',
          lead: 'You will now receive alerts when San Roque Dam releases water, reservoir levels rise, or heavy rain is expected over San Manuel.',
          sourceLine: 'Alerts are based on the official PAGASA dam bulletin and rainfall data.',
          visit: 'View the map and current conditions',
          unsub: 'Unsubscribe',
        };

  const html = shell(
    '#2E7D32',
    t.header,
    `<p style="margin:0 0 14px">${t.lead}</p>
     <p style="margin:0 0 18px;font-size:13px;color:#555">${t.sourceLine}</p>
     <p style="margin:0"><a href="${SITE}" style="color:${BRAND};font-weight:600">${t.visit}</a></p>`,
    `<a href="${unsubscribeUrl}" style="color:#666">${t.unsub}</a>`,
  );

  const text = [t.header, '', t.lead, '', t.sourceLine, '', SITE, '', `${t.unsub}: ${unsubscribeUrl}`].join('\n');
  return { subject: t.subject, html, text };
}

// ---------------------------------------------------------------------------
export interface AlertEmailInput {
  severity: Severity;
  title: string;
  body: string;
  actionAdvice: string;
  subject: string;
  detailsUrl: string;
  unsubscribeUrl: string;
  lang: Lang;
  facts?: Array<{ label: string; value: string }>;
}

export function renderAlert(input: AlertEmailInput): Rendered {
  const color = SEVERITY_COLORS[input.severity as keyof typeof SEVERITY_COLORS] ?? BRAND;
  const isTl = input.lang === 'tl';

  const factRows = (input.facts ?? [])
    .map(
      (f) =>
        `<tr><td style="color:#555;padding:4px 12px 4px 0">${f.label}</td><td style="font-weight:700;padding:4px 0">${f.value}</td></tr>`,
    )
    .join('');

  const html = shell(
    color,
    `&#9888; ${input.title}`,
    `<p style="margin:0 0 14px">${input.body}</p>
     ${factRows ? `<table role="presentation" style="border-collapse:collapse;margin:0 0 16px;font-size:14px">${factRows}</table>` : ''}
     <p style="margin:0 0 18px;padding:12px 14px;background:#fff4e5;border-left:4px solid ${color};font-weight:600">${input.actionAdvice}</p>
     <p style="margin:0"><a href="${input.detailsUrl}" style="color:${BRAND};font-weight:600">${isTl ? 'Tingnan ang detalye at mapa' : 'View details and map'}</a></p>`,
    `${isTl ? 'Pinagmulan' : 'Source'}: PAGASA Dam Bulletin, Open-Meteo.<br>
     <a href="${input.unsubscribeUrl}" style="color:#666">${isTl ? 'Mag-unsubscribe' : 'Unsubscribe'}</a>`,
  );

  const text = [
    input.title.toUpperCase(),
    '',
    input.body,
    ...(input.facts ?? []).map((f) => `${f.label}: ${f.value}`),
    '',
    input.actionAdvice,
    '',
    input.detailsUrl,
    '',
    `${isTl ? 'Pinagmulan' : 'Source'}: PAGASA Dam Bulletin, Open-Meteo`,
    `${isTl ? 'Mag-unsubscribe' : 'Unsubscribe'}: ${input.unsubscribeUrl}`,
  ].join('\n');

  return { subject: input.subject, html, text };
}
