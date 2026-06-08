/**
 * Manual carrier (per `14-shipping.md`) — PPL / DPD / Česká pošta / Balíkovna
 * and any other carrier without a wired API. Produces a deterministic
 * placeholder label (pdfkit) and a provisional barcode immediately so the
 * fulfillment flow works; the merchant pastes the real tracking number after
 * handing the parcel to the carrier (PATCH …/tracking), which also rewrites the
 * tracking URL from the carrier's public template.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import type { CarrierLabelInput, CarrierLabelResult, CarrierProvider } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_REGULAR = resolve(__dirname, '..', '..', '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = resolve(__dirname, '..', '..', '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');

/** Public tracking URL templates ({code} = tracking number). */
const TRACKING_TEMPLATES: Record<string, string> = {
  ppl: 'https://www.ppl.cz/sledovani-zasilky?shipmentId={code}',
  dpd: 'https://www.dpd.com/cz/cs/sledovani/?parcelNumber={code}',
  cp: 'https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers={code}',
  ceska_posta: 'https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers={code}',
  balikovna: 'https://www.balikovna.cz/cs/sledovani-zasilky?id={code}',
  gls: 'https://gls-group.com/CZ/cs/sledovani-zasilek?match={code}',
};

const DISPLAY_NAMES: Record<string, string> = {
  ppl: 'PPL',
  dpd: 'DPD',
  cp: 'Česká pošta',
  ceska_posta: 'Česká pošta',
  balikovna: 'Balíkovna',
  gls: 'GLS',
};

export class ManualCarrier implements CarrierProvider {
  readonly real = false;
  readonly displayName: string;

  constructor(readonly code: string) {
    this.displayName = DISPLAY_NAMES[code] ?? code.toUpperCase();
  }

  trackingUrl(barcode: string): string | null {
    const tpl = TRACKING_TEMPLATES[this.code];
    return tpl ? tpl.replace('{code}', encodeURIComponent(barcode)) : null;
  }

  async createLabel(input: CarrierLabelInput): Promise<CarrierLabelResult> {
    // Deterministic provisional barcode from the shipment number (stable across
    // retries) until the merchant enters the carrier's real one.
    const digits = createHash('sha256')
      .update(`${this.code}:${input.shipmentNumber}`)
      .digest('hex')
      .replace(/\D/g, '')
      .slice(0, 12)
      .padEnd(12, '0');
    const barcode = `${this.code.toUpperCase().slice(0, 3)}${digits}`;

    const destination = input.pickup?.name
      ? `Výdejní místo: ${input.pickup.name}`
      : `${input.address?.line1 ?? ''}, ${input.address?.postalCode ?? ''} ${input.address?.city ?? ''}`;

    const labelPdf = await renderManualLabel(this.displayName, barcode, {
      orderNumber: input.orderNumber,
      recipientName: input.recipientName,
      destinationLine: destination,
    });

    return {
      provider: 'manual',
      carrierShipmentId: barcode,
      barcode,
      trackingUrl: this.trackingUrl(barcode),
      labelPdfBase64: labelPdf.toString('base64'),
    };
  }
}

async function renderManualLabel(
  carrierName: string,
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

  doc.font(bold).fontSize(14).text(`${carrierName.toUpperCase()} — ŠTÍTEK`, { align: 'center' });
  doc
    .font(regular)
    .fontSize(8)
    .fillColor('#666')
    .text('Předběžný štítek — po předání zásilky doplňte sledovací číslo dopravce', {
      align: 'center',
    });
  doc.moveDown(1.5);
  doc.fillColor('#000').font(bold).fontSize(22).text(barcode, { align: 'center' });
  doc.moveDown(1);
  doc.font(regular).fontSize(11);
  doc.text(`Objednávka: ${ctx.orderNumber}`);
  doc.text(`Příjemce: ${ctx.recipientName}`);
  doc.text(`Doručení: ${ctx.destinationLine}`);
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

/** Re-export the tracking templates for the manual-tracking PATCH endpoint. */
export function manualTrackingUrl(carrierCode: string, barcode: string): string | null {
  const tpl = TRACKING_TEMPLATES[carrierCode];
  return tpl ? tpl.replace('{code}', encodeURIComponent(barcode)) : null;
}
