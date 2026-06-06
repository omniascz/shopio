/**
 * Zásilkovna / Packeta carrier client — per `14-shipping.md` §6 (createPacket
 * + packetLabelPdf subset).
 *
 * Real mode: PACKETA_API_PASSWORD set → REST API (XML envelope) at
 * https://www.zasilkovna.cz/api/rest. Pickup-point shipments use addressId =
 * the point's external id; home delivery needs the carrier id configured in
 * shipping_provider_configs.options.home_delivery_carrier_id (Packeta "ZB"
 * external carriers).
 *
 * Mock mode (no password): deterministic fake barcode + a pdfkit-rendered
 * placeholder label so the whole fulfillment flow works in dev. The shipment
 * row records `label_provider` so mock labels are distinguishable.
 */

import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { ShopioConfig } from '../config';

const PACKETA_REST_URL = 'https://www.zasilkovna.cz/api/rest';

export interface CreatePacketInput {
  /** Merchant-side reference (order number, ≤20 chars relevant for Packeta). */
  number: string;
  /** Mock-mode barcode seed — MUST be unique per shipment (shipment number),
   * not per order, so split shipments don't collide on the tracking unique. */
  mockSeed?: string | undefined;
  /** Tenant REST API password override (admin settings); env fallback. */
  apiPassword?: string | null | undefined;
  name: string;
  surname: string;
  email: string;
  phone?: string | undefined;
  /** Order value for insurance (major units, e.g. 1917.00). */
  valueMajor: number;
  weightKg: number;
  /** Pickup point external id (pickup_point service). */
  pickupPointExternalId?: string | undefined;
  /** Carrier id for home delivery (from provider config). */
  homeDeliveryCarrierId?: string | undefined;
  address?: {
    street: string;
    city: string;
    zip: string;
  };
}

export interface CreatePacketResult {
  provider: 'packeta' | 'mock';
  carrierShipmentId: string;
  barcode: string;
}

export class PacketaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function isPacketaEnabled(config: ShopioConfig): boolean {
  return Boolean(config.PACKETA_API_PASSWORD);
}

/** Tenant-level password (admin settings) wins over the platform env. */
export function resolveApiPassword(
  config: ShopioConfig,
  tenantApiPassword?: string | null,
): string | null {
  return tenantApiPassword ?? config.PACKETA_API_PASSWORD ?? null;
}

function xmlEsc(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function extract(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? m[1]!.trim() : null;
}

/**
 * Create a packet at Packeta (or mock). Returns carrier id + barcode.
 */
export async function createPacket(
  config: ShopioConfig,
  input: CreatePacketInput,
): Promise<CreatePacketResult> {
  const apiPassword = resolveApiPassword(config, input.apiPassword);
  if (!apiPassword) {
    // Deterministic mock — same shipment retries produce the same barcode.
    const digest = createHash('sha256')
      .update(`packeta:${input.mockSeed ?? input.number}`)
      .digest('hex');
    const digits = String(parseInt(digest.slice(0, 10), 16) % 1_000_000_000).padStart(9, '0');
    return {
      provider: 'mock',
      carrierShipmentId: `mock_${digits}`,
      barcode: `Z${digits}`,
    };
  }

  const addressId = input.pickupPointExternalId ?? input.homeDeliveryCarrierId;
  if (!addressId) {
    throw new PacketaError(
      'MISSING_ADDRESS_ID',
      'Pickup point id or home-delivery carrier id required',
    );
  }

  const body = `<?xml version="1.0" encoding="utf-8"?>
<createPacket>
  <apiPassword>${xmlEsc(apiPassword)}</apiPassword>
  <packetAttributes>
    <number>${xmlEsc(input.number)}</number>
    <name>${xmlEsc(input.name)}</name>
    <surname>${xmlEsc(input.surname)}</surname>
    <email>${xmlEsc(input.email)}</email>${
      input.phone
        ? `
    <phone>${xmlEsc(input.phone)}</phone>`
        : ''
    }
    <addressId>${xmlEsc(addressId)}</addressId>
    <value>${input.valueMajor.toFixed(2)}</value>
    <weight>${input.weightKg.toFixed(3)}</weight>${
      input.address
        ? `
    <street>${xmlEsc(input.address.street)}</street>
    <city>${xmlEsc(input.address.city)}</city>
    <zip>${xmlEsc(input.address.zip)}</zip>`
        : ''
    }
    <eshop>shopio</eshop>
  </packetAttributes>
</createPacket>`;

  const res = await fetch(PACKETA_REST_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/xml' },
    body,
  });
  const xml = await res.text();
  const status = extract(xml, 'status');
  if (status !== 'ok') {
    const fault = extract(xml, 'fault') ?? extract(xml, 'string') ?? 'unknown';
    throw new PacketaError('CREATE_PACKET_FAILED', `Packeta createPacket failed: ${fault}`);
  }
  const id = extract(xml, 'id');
  const barcode = extract(xml, 'barcode');
  if (!id || !barcode) {
    throw new PacketaError('CREATE_PACKET_MALFORMED', 'Packeta response missing id/barcode');
  }
  return { provider: 'packeta', carrierShipmentId: id, barcode };
}

/**
 * Fetch the A6 label PDF for a created packet (real mode) or render a
 * placeholder label (mock mode).
 */
export async function getLabelPdf(
  config: ShopioConfig,
  packet: CreatePacketResult,
  context: {
    orderNumber: string;
    recipientName: string;
    destinationLine: string;
    apiPassword?: string | null | undefined;
  },
): Promise<Buffer> {
  if (packet.provider === 'mock') {
    return renderMockLabel(packet.barcode, context);
  }
  const apiPassword = resolveApiPassword(config, context.apiPassword);
  if (!apiPassword) throw new PacketaError('NO_API_PASSWORD', 'Packeta password missing');

  const body = `<?xml version="1.0" encoding="utf-8"?>
<packetLabelPdf>
  <apiPassword>${xmlEsc(apiPassword)}</apiPassword>
  <packetId>${xmlEsc(packet.carrierShipmentId)}</packetId>
  <format>A6 on A6</format>
  <offset>0</offset>
</packetLabelPdf>`;

  const res = await fetch(PACKETA_REST_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/xml' },
    body,
  });
  const xml = await res.text();
  const status = extract(xml, 'status');
  const result = extract(xml, 'result');
  if (status !== 'ok' || !result) {
    const fault = extract(xml, 'fault') ?? 'unknown';
    throw new PacketaError('LABEL_FAILED', `Packeta packetLabelPdf failed: ${fault}`);
  }
  return Buffer.from(result, 'base64');
}

export function trackingUrlFor(barcode: string): string {
  return `https://tracking.packeta.com/cs/?id=${encodeURIComponent(barcode)}`;
}

// =============================================================================
// Mock label (dev without credentials)
// =============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_REGULAR = resolve(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = resolve(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');

async function renderMockLabel(
  barcode: string,
  ctx: { orderNumber: string; recipientName: string; destinationLine: string },
): Promise<Buffer> {
  // A6 landscape: 420×298 pt
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

  doc.font(bold).fontSize(14).text('ZÁSILKOVNA — MOCK ŠTÍTEK', { align: 'center' });
  doc
    .font(regular)
    .fontSize(8)
    .fillColor('#666')
    .text('Vygenerováno bez PACKETA_API_PASSWORD — pouze pro vývoj', { align: 'center' });
  doc.moveDown(1.5);
  doc.fillColor('#000').font(bold).fontSize(24).text(barcode, { align: 'center' });
  doc.moveDown(1);
  doc.font(regular).fontSize(11);
  doc.text(`Objednávka: ${ctx.orderNumber}`);
  doc.text(`Příjemce: ${ctx.recipientName}`);
  doc.text(`Doručení: ${ctx.destinationLine}`);
  // Fake barcode strokes (visual only)
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
