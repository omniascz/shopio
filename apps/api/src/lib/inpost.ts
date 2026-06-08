/**
 * InPost ShipX client (PL market, per `14-shipping.md` + `29`). InPost
 * Paczkomaty (parcel lockers) are the dominant PL delivery method — the Polish
 * equivalent of Zásilkovna. Real mode talks to the ShipX API when a per-tenant
 * token + organization id are configured; otherwise a deterministic mock label
 * is produced so fulfillment works end-to-end (same fallback pattern as Packeta
 * and the payment gateways).
 *
 * CAVEAT: the real ShipX flow is coded from the public docs and exercised only
 * against the mock — verify in the InPost sandbox (token, organization id, the
 * shipment offer/confirm steps) before going live.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_REGULAR = resolve(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = resolve(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');

const SHIPX_BASE = 'https://api-shipx-pl.easypack24.net/v1';

export function trackingUrlFor(barcode: string): string {
  return `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(barcode)}`;
}

export interface InPostShipmentInput {
  orderNumber: string;
  mockSeed: string;
  apiToken?: string | null;
  organizationId?: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientPhone?: string | undefined;
  weightKg: number;
  /** Paczkomat locker code (parcel-locker service); absent = courier. */
  targetPoint?: string | undefined;
  address?: { street?: string; city?: string; postalCode?: string } | undefined;
}

export interface InPostShipment {
  provider: 'inpost' | 'mock';
  carrierShipmentId: string;
  barcode: string;
}

/**
 * Create an InPost shipment. Real ShipX when token+org are set, else a
 * deterministic mock (stable across retries via `mockSeed`).
 */
export async function createInPostShipment(input: InPostShipmentInput): Promise<InPostShipment> {
  const useReal = Boolean(input.apiToken && input.organizationId);
  if (!useReal) {
    const digits = createHash('sha256')
      .update(`inpost:${input.mockSeed}`)
      .digest('hex')
      .replace(/\D/g, '')
      .slice(0, 12)
      .padEnd(12, '0');
    return { provider: 'mock', carrierShipmentId: `inpost_mock_${input.mockSeed}`, barcode: `6900${digits}` };
  }

  const service = input.targetPoint ? 'inpost_locker_standard' : 'inpost_courier_standard';
  const body: Record<string, unknown> = {
    receiver: {
      first_name: input.recipientName.split(' ')[0] ?? input.recipientName,
      last_name: input.recipientName.split(' ').slice(1).join(' ') || '-',
      email: input.recipientEmail,
      phone: (input.recipientPhone ?? '').replace(/\D/g, '').slice(-9),
    },
    parcels: [{ template: 'small' }],
    service,
    ...(input.targetPoint
      ? { custom_attributes: { target_point: input.targetPoint } }
      : {
          receiver_address: {
            street: input.address?.street ?? '',
            city: input.address?.city ?? '',
            post_code: input.address?.postalCode ?? '',
            country_code: 'PL',
          },
        }),
  };

  const res = await fetch(`${SHIPX_BASE}/organizations/${input.organizationId}/shipments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`InPost ShipX create ${res.status}`);
  const j = (await res.json()) as { id?: number | string; tracking_number?: string };
  if (!j.id) throw new Error('InPost ShipX missing shipment id');
  return {
    provider: 'inpost',
    carrierShipmentId: String(j.id),
    barcode: j.tracking_number ?? String(j.id),
  };
}

/** Fetch the ShipX label PDF (real), or render a mock label. */
export async function getInPostLabel(
  shipment: InPostShipment,
  ctx: {
    apiToken?: string | null;
    orderNumber: string;
    recipientName: string;
    destinationLine: string;
  },
): Promise<Buffer> {
  if (shipment.provider === 'inpost' && ctx.apiToken) {
    const res = await fetch(`${SHIPX_BASE}/shipments/${shipment.carrierShipmentId}/label?format=pdf`, {
      headers: { Authorization: `Bearer ${ctx.apiToken}` },
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    // Fall through to a placeholder if the label isn't ready yet.
  }
  return renderMockLabel(shipment.barcode, ctx);
}

async function renderMockLabel(
  barcode: string,
  ctx: { orderNumber: string; recipientName: string; destinationLine: string },
): Promise<Buffer> {
  const doc = new PDFDocument({ size: [420, 298], margin: 18 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((res, rej) => {
    doc.on('end', () => res(Buffer.concat(chunks)));
    doc.on('error', rej);
  });
  const hasFonts = existsSync(FONT_REGULAR) && existsSync(FONT_BOLD);
  const regular = hasFonts ? FONT_REGULAR : 'Helvetica';
  const bold = hasFonts ? FONT_BOLD : 'Helvetica-Bold';

  doc.font(bold).fontSize(14).text('INPOST — ETYKIETA', { align: 'center' });
  doc
    .font(regular)
    .fontSize(8)
    .fillColor('#666')
    .text('Etykieta zastępcza (mock) — zweryfikuj w sandboxie ShipX przed produkcją', { align: 'center' });
  doc.moveDown(1.5);
  doc.fillColor('#000').font(bold).fontSize(20).text(barcode, { align: 'center' });
  doc.moveDown(1);
  doc.font(regular).fontSize(11);
  doc.text(`Zamówienie: ${ctx.orderNumber}`);
  doc.text(`Odbiorca: ${ctx.recipientName}`);
  doc.text(`Dostawa: ${ctx.destinationLine}`);
  let x = 30;
  const hash = createHash('sha256').update(barcode).digest();
  for (let i = 0; i < 60; i++) {
    const w = (hash[i % hash.length]! % 3) + 1;
    doc.rect(x, 230, w, 40).fill('#000');
    x += w + 2;
    if (x > 390) break;
  }
  doc.end();
  return finished;
}
