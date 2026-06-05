/**
 * Email service — transactional notifications.
 *
 * Per `19-email-marketing.md §3` (transactional subset for MVP).
 *
 * Dev: SMTP → Mailpit (port 1027 → web UI http://localhost:8027)
 * Prod: SMTP relay to Postmark / SendGrid (Fáze 1 wave 2)
 *
 * Templates kept inline (no template engine) — MVP. Migration to MJML +
 * locale-aware rendering deferred to Wave 2 (per `19 §6`).
 */

import nodemailer, { type Transporter } from 'nodemailer';
import type { ShopioConfig } from '../config';

let _transporter: Transporter | null = null;

export function getTransporter(config: ShopioConfig): Transporter | null {
  if (!config.SMTP_ENABLED) return null;
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: false, // Mailpit is plain; prod SMTP relay handles TLS itself
    ignoreTLS: config.SMTP_HOST === 'localhost',
    ...(config.SMTP_USER && {
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
    }),
  });

  return _transporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

export async function sendEmail(config: ShopioConfig, input: SendEmailInput): Promise<void> {
  const transporter = getTransporter(config);
  if (!transporter) {
    // Email disabled — log + drop. Use case: tests where we don't want SMTP noise.
    return;
  }

  await transporter.sendMail({
    from: config.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    ...(input.replyTo && { replyTo: input.replyTo }),
    ...(input.attachments?.length && { attachments: input.attachments }),
  });
}

// =============================================================================
// Templates
// =============================================================================

export interface OrderEmailContext {
  tenantName: string;
  tenantSlug: string;
  storefrontBaseUrl: string;
  orderNumber: string;
  customerName: string | null;
  customerEmail: string;
  shippingAddress: {
    line1: string;
    line2?: string | null | undefined;
    city: string;
    postalCode: string;
    countryCode: string;
  };
  items: {
    productTitle: string;
    variantTitle: string;
    sku: string | null;
    quantity: number;
    lineTotalMinor: bigint;
  }[];
  currency: string;
  totalMinor: bigint;
  /** Gross shipping fee + label (optional — omitted = no shipping line). */
  shippingMinor?: bigint;
  shippingLabel?: string;
  /** Selected pickup point name, if any. */
  pickupPointName?: string | null;
  placedAt: Date;
}

function fmtMoney(amountMinor: bigint, currency: string, locale = 'cs-CZ'): string {
  const major = Number(amountMinor) / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(major);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderOrderPlacedEmail(ctx: OrderEmailContext): {
  subject: string;
  text: string;
  html: string;
} {
  const confirmationUrl = `${ctx.storefrontBaseUrl}/s/${ctx.tenantSlug}/orders/${ctx.orderNumber}?email=${encodeURIComponent(ctx.customerEmail)}`;
  const totalStr = fmtMoney(ctx.totalMinor, ctx.currency);

  const subject = `Objednávka ${ctx.orderNumber} přijata`;

  const text = [
    `Dobrý den${ctx.customerName ? ` ${ctx.customerName}` : ''},`,
    '',
    `děkujeme za vaši objednávku v obchodě ${ctx.tenantName}.`,
    '',
    `Číslo objednávky: ${ctx.orderNumber}`,
    `Stav: čekání na platbu`,
    `Celková částka: ${totalStr}`,
    '',
    'Položky:',
    ...ctx.items.map(
      (it) =>
        `  • ${it.productTitle} — ${it.variantTitle} (${it.sku ?? '—'}) × ${it.quantity} — ${fmtMoney(it.lineTotalMinor, ctx.currency)}`,
    ),
    ...(ctx.shippingMinor !== undefined
      ? [
          `Doprava${ctx.shippingLabel ? ` (${ctx.shippingLabel})` : ''}: ${ctx.shippingMinor === 0n ? 'Zdarma' : fmtMoney(ctx.shippingMinor, ctx.currency)}`,
        ]
      : []),
    ...(ctx.pickupPointName ? [`Výdejní místo: ${ctx.pickupPointName}`] : []),
    '',
    'Doručovací adresa:',
    `  ${ctx.shippingAddress.line1}`,
    ...(ctx.shippingAddress.line2 ? [`  ${ctx.shippingAddress.line2}`] : []),
    `  ${ctx.shippingAddress.postalCode} ${ctx.shippingAddress.city}`,
    `  ${ctx.shippingAddress.countryCode}`,
    '',
    `Detail objednávky: ${confirmationUrl}`,
    '',
    `S pozdravem,`,
    `${ctx.tenantName}`,
  ].join('\n');

  const itemRows = ctx.items
    .map(
      (it) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            <strong>${escapeHtml(it.productTitle)}</strong><br/>
            <span style="color:#666;font-size:13px;">${escapeHtml(it.variantTitle)}${it.sku ? ` · ${escapeHtml(it.sku)}` : ''} · × ${it.quantity}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:500;">
            ${fmtMoney(it.lineTotalMinor, ctx.currency)}
          </td>
        </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#222;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="padding:24px 28px;border-bottom:1px solid #eee;">
      <h1 style="margin:0;font-size:22px;">Objednávka přijata</h1>
      <p style="margin:8px 0 0;color:#666;font-size:14px;">${escapeHtml(ctx.orderNumber)} · ${ctx.placedAt.toLocaleString('cs-CZ')}</p>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 16px;">Dobrý den${ctx.customerName ? ` <strong>${escapeHtml(ctx.customerName)}</strong>` : ''},</p>
      <p style="margin:0 0 16px;">děkujeme za vaši objednávku v obchodě <strong>${escapeHtml(ctx.tenantName)}</strong>. Brzy vás budeme informovat o průběhu.</p>

      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        ${itemRows}
        ${
          ctx.shippingMinor !== undefined
            ? `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#444;">Doprava${ctx.shippingLabel ? ` <span style="color:#888;font-size:13px;">· ${escapeHtml(ctx.shippingLabel)}</span>` : ''}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${ctx.shippingMinor === 0n ? 'Zdarma' : fmtMoney(ctx.shippingMinor, ctx.currency)}</td>
        </tr>`
            : ''
        }
        <tr>
          <td style="padding:12px 0 0;font-weight:600;">Celkem</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:600;font-size:18px;">${totalStr}</td>
        </tr>
      </table>
      ${
        ctx.pickupPointName
          ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Výdejní místo:</strong> ${escapeHtml(ctx.pickupPointName)}</p>`
          : ''
      }

      <h2 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.04em;margin:24px 0 8px;">Doručovací adresa</h2>
      <p style="margin:0;line-height:1.5;font-size:14px;">
        ${ctx.customerName ? `${escapeHtml(ctx.customerName)}<br/>` : ''}
        ${escapeHtml(ctx.shippingAddress.line1)}<br/>
        ${ctx.shippingAddress.line2 ? `${escapeHtml(ctx.shippingAddress.line2)}<br/>` : ''}
        ${escapeHtml(ctx.shippingAddress.postalCode)} ${escapeHtml(ctx.shippingAddress.city)}<br/>
        ${escapeHtml(ctx.shippingAddress.countryCode)}
      </p>

      <div style="margin:32px 0;text-align:center;">
        <a href="${confirmationUrl}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:4px;font-weight:500;">
          Zobrazit objednávku
        </a>
      </div>

      <p style="margin:24px 0 0;color:#666;font-size:13px;">
        S pozdravem,<br/>
        ${escapeHtml(ctx.tenantName)}
      </p>
    </div>
  </div>
  <p style="text-align:center;margin:16px 0 0;color:#999;font-size:12px;">
    Tento e-mail byl vygenerován automaticky. Pokud máte dotaz, odpovězte na něj.
  </p>
</body>
</html>`;

  return { subject, text, html };
}

export function renderOrderPaidEmail(ctx: OrderEmailContext): {
  subject: string;
  text: string;
  html: string;
} {
  const confirmationUrl = `${ctx.storefrontBaseUrl}/s/${ctx.tenantSlug}/orders/${ctx.orderNumber}?email=${encodeURIComponent(ctx.customerEmail)}`;
  const totalStr = fmtMoney(ctx.totalMinor, ctx.currency);
  const subject = `Platba za objednávku ${ctx.orderNumber} přijata`;

  const text = [
    `Dobrý den${ctx.customerName ? ` ${ctx.customerName}` : ''},`,
    '',
    `vaše platba za objednávku ${ctx.orderNumber} (${totalStr}) byla úspěšně přijata.`,
    'Objednávka teď přechází do přípravy k odeslání. Brzy obdržíte další informace.',
    '',
    `Detail objednávky: ${confirmationUrl}`,
    '',
    `S pozdravem,`,
    `${ctx.tenantName}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"/><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#222;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="padding:24px 28px;background:#e8f5e9;border-bottom:1px solid #c8e6c9;">
      <h1 style="margin:0;font-size:22px;">✓ Platba přijata</h1>
      <p style="margin:8px 0 0;color:#2e7d32;font-size:14px;">${escapeHtml(ctx.orderNumber)}</p>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 16px;">Dobrý den${ctx.customerName ? ` <strong>${escapeHtml(ctx.customerName)}</strong>` : ''},</p>
      <p style="margin:0 0 16px;">vaše platba ve výši <strong>${totalStr}</strong> za objednávku ${escapeHtml(ctx.orderNumber)} byla úspěšně přijata.</p>
      <p style="margin:0 0 24px;">Objednávka teď přechází do přípravy k odeslání.</p>
      <div style="margin:24px 0;text-align:center;">
        <a href="${confirmationUrl}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:4px;font-weight:500;">
          Zobrazit objednávku
        </a>
      </div>
      <p style="margin:24px 0 0;color:#666;font-size:13px;">S pozdravem,<br/>${escapeHtml(ctx.tenantName)}</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
