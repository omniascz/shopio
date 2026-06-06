/**
 * Invoice PDF rendering — pdfkit + embedded DejaVu Sans (Czech diacritics;
 * the 14 built-in PDF fonts only cover WinAnsi, which lacks ě/š/č/ř/ž…).
 *
 * Renders from the immutable invoice snapshot — deterministic, generated on
 * demand (no object storage needed yet). Layout: simple single-page CZ
 * "faktura — daňový doklad" with seller/buyer blocks, line table, and the
 * per-rate VAT recap required for tax documents.
 */

import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { schema } from '@shopio/db';
import type { BuyerSnapshot, SellerSnapshot } from './invoices';

type Invoice = typeof schema.invoices.$inferSelect;
type InvoiceItem = typeof schema.invoiceItems.$inferSelect;

interface BreakdownEntry {
  tax_class: string;
  rate_basis_points: number;
  base_amount: string;
  tax_amount: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = resolve(__dirname, '..', '..', 'assets', 'fonts');
const FONT_REGULAR = resolve(FONT_DIR, 'DejaVuSans.ttf');
const FONT_BOLD = resolve(FONT_DIR, 'DejaVuSans-Bold.ttf');

function fmtMoney(minor: bigint, currency: string): string {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(minor) / 100);
}

function fmtDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: 'UTC' }).format(d);
}

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 portrait
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

/** Render the invoice as a PDF buffer. */
export async function renderInvoicePdf(
  invoice: Invoice,
  items: InvoiceItem[],
): Promise<Buffer> {
  const seller = invoice.sellerSnapshot as unknown as SellerSnapshot;
  const buyer = invoice.buyerSnapshot as unknown as BuyerSnapshot;
  const breakdown = (invoice.taxBreakdown ?? []) as unknown as BreakdownEntry[];
  const isCreditNote = invoice.kind === 'credit_note';
  const currency = invoice.currency;

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((resolvePromise, rejectPromise) => {
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', rejectPromise);
  });

  const hasFonts = existsSync(FONT_REGULAR) && existsSync(FONT_BOLD);
  const regular = hasFonts ? FONT_REGULAR : 'Helvetica';
  const bold = hasFonts ? FONT_BOLD : 'Helvetica-Bold';

  // ---- Header -------------------------------------------------------------
  doc.font(bold).fontSize(18).text(isCreditNote ? 'Dobropis (opravný daňový doklad)' : 'Faktura — daňový doklad', PAGE_MARGIN, PAGE_MARGIN);
  doc.font(regular).fontSize(11).fillColor('#444').text(`č. ${invoice.number}`);
  if (!seller.is_vat_payer) {
    doc.text('Dodavatel není plátcem DPH.');
  }
  doc.fillColor('#000');

  // ---- Parties ------------------------------------------------------------
  const partyTop = doc.y + 18;
  const colWidth = CONTENT_WIDTH / 2 - 10;

  doc.font(bold).fontSize(9).fillColor('#666').text('DODAVATEL', PAGE_MARGIN, partyTop);
  doc.font(bold).fontSize(11).fillColor('#000').text(seller.name, PAGE_MARGIN, doc.y + 2, { width: colWidth });
  doc.font(regular).fontSize(9.5);
  for (const line of [
    seller.line1,
    seller.line2,
    [seller.postal_code, seller.city].filter(Boolean).join(' '),
    seller.country_code,
    seller.ico ? `IČO: ${seller.ico}` : null,
    seller.dic ? `DIČ: ${seller.dic}` : null,
  ]) {
    if (line) doc.text(line, { width: colWidth });
  }
  const sellerBottom = doc.y;

  const buyerX = PAGE_MARGIN + CONTENT_WIDTH / 2 + 10;
  doc.font(bold).fontSize(9).fillColor('#666').text('ODBĚRATEL', buyerX, partyTop);
  doc.font(bold).fontSize(11).fillColor('#000').text(buyer.name ?? buyer.email, buyerX, doc.y + 2, { width: colWidth });
  doc.font(regular).fontSize(9.5);
  for (const line of [
    buyer.line1,
    buyer.line2,
    [buyer.postal_code, buyer.city].filter(Boolean).join(' '),
    buyer.country_code,
    buyer.registration_number ? `IČO: ${buyer.registration_number}` : null,
    buyer.vat_id ? `DIČ: ${buyer.vat_id}` : null,
    buyer.email,
  ]) {
    if (line) doc.text(line, { width: colWidth });
  }

  // ---- Meta block ---------------------------------------------------------
  let y = Math.max(sellerBottom, doc.y) + 20;
  doc.font(regular).fontSize(9.5);
  const meta: [string, string][] = [
    ['Datum vystavení', fmtDate(invoice.issuedAt)],
    ['DUZP', fmtDate(invoice.taxableSupplyDate)],
    ...(invoice.dueDate ? ([['Datum splatnosti', fmtDate(invoice.dueDate)]] as [string, string][]) : []),
    ...(invoice.variableSymbol ? ([['Variabilní symbol', invoice.variableSymbol]] as [string, string][]) : []),
    ...(seller.bank_account_iban ? ([['IBAN', seller.bank_account_iban]] as [string, string][]) : []),
    [
      'Způsob platby',
      invoice.paymentMethodKind === 'card'
        ? 'Platební karta (uhrazeno)'
        : (invoice.paymentMethodKind ?? '—'),
    ],
  ];
  for (const [label, value] of meta) {
    doc.fillColor('#666').text(`${label}:`, PAGE_MARGIN, y, { width: 130, continued: false });
    doc.fillColor('#000').text(value, PAGE_MARGIN + 135, y);
    y = doc.y + 2;
  }

  // ---- Line items table ---------------------------------------------------
  y += 14;
  const cols = {
    title: { x: PAGE_MARGIN, w: 215 },
    qty: { x: PAGE_MARGIN + 220, w: 30, align: 'right' as const },
    unit: { x: PAGE_MARGIN + 255, w: 65, align: 'right' as const },
    rate: { x: PAGE_MARGIN + 325, w: 35, align: 'right' as const },
    tax: { x: PAGE_MARGIN + 365, w: 60, align: 'right' as const },
    gross: { x: PAGE_MARGIN + 430, w: CONTENT_WIDTH - 430, align: 'right' as const },
  };

  doc.font(bold).fontSize(8).fillColor('#666');
  doc.text('POLOŽKA', cols.title.x, y, { width: cols.title.w });
  doc.text('KS', cols.qty.x, y, { width: cols.qty.w, align: 'right' });
  doc.text('CENA/KS', cols.unit.x, y, { width: cols.unit.w, align: 'right' });
  doc.text('DPH %', cols.rate.x, y, { width: cols.rate.w, align: 'right' });
  doc.text('DPH', cols.tax.x, y, { width: cols.tax.w, align: 'right' });
  doc.text('CELKEM', cols.gross.x, y, { width: cols.gross.w, align: 'right' });
  y = doc.y + 3;
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y).strokeColor('#999').lineWidth(0.7).stroke();
  y += 6;

  doc.font(regular).fontSize(9).fillColor('#000');
  for (const it of items) {
    const sign = isCreditNote ? '−' : '';
    doc.text(it.sku ? `${it.title} (${it.sku})` : it.title, cols.title.x, y, { width: cols.title.w });
    const rowBottom = doc.y;
    doc.text(String(it.quantity), cols.qty.x, y, { width: cols.qty.w, align: 'right' });
    doc.text(fmtMoney(it.unitPriceAmount, currency), cols.unit.x, y, { width: cols.unit.w, align: 'right' });
    doc.text((it.taxRateBasisPoints / 100).toFixed(0) + ' %', cols.rate.x, y, { width: cols.rate.w, align: 'right' });
    doc.text(sign + fmtMoney(it.taxAmount, currency), cols.tax.x, y, { width: cols.tax.w, align: 'right' });
    doc.text(sign + fmtMoney(it.grossAmount, currency), cols.gross.x, y, { width: cols.gross.w, align: 'right' });
    y = Math.max(rowBottom, doc.y) + 4;
  }

  y += 2;
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y).strokeColor('#999').lineWidth(0.7).stroke();
  y += 10;

  // ---- VAT recap per rate (required on CZ tax documents) -------------------
  doc.font(bold).fontSize(8).fillColor('#666').text('REKAPITULACE DPH', PAGE_MARGIN, y);
  y = doc.y + 4;
  doc.font(regular).fontSize(9).fillColor('#000');
  for (const b of breakdown) {
    const base = BigInt(b.base_amount);
    const tax = BigInt(b.tax_amount);
    doc.text(
      `Sazba ${(b.rate_basis_points / 100).toFixed(0)} % — základ ${fmtMoney(base, currency)}, DPH ${fmtMoney(tax, currency)}`,
      PAGE_MARGIN,
      y,
    );
    y = doc.y + 2;
  }

  // ---- Totals -------------------------------------------------------------
  y += 10;
  const sign = isCreditNote ? '−' : '';
  const totalsRows: [string, string, boolean][] = [
    ['Základ daně celkem', sign + fmtMoney(invoice.subtotalAmount, currency), false],
    ['DPH celkem', sign + fmtMoney(invoice.taxAmount, currency), false],
    [
      isCreditNote ? 'Dobropisovaná částka' : 'Celkem k úhradě',
      sign + fmtMoney(invoice.totalAmount, currency),
      true,
    ],
  ];
  for (const [label, value, isTotal] of totalsRows) {
    doc.font(isTotal ? bold : regular).fontSize(isTotal ? 12 : 9.5);
    doc.fillColor('#666').text(label, PAGE_MARGIN + 230, y, { width: 160, align: 'right' });
    doc.fillColor('#000').text(value, PAGE_MARGIN + 395, y, { width: CONTENT_WIDTH - 395, align: 'right' });
    y = doc.y + (isTotal ? 4 : 3);
  }

  // ---- Footer ---------------------------------------------------------------
  doc
    .font(regular)
    .fontSize(8)
    .fillColor('#999')
    .text(
      `Vystaveno systémem Shopio • ${invoice.number}`,
      PAGE_MARGIN,
      780,
      { width: CONTENT_WIDTH, align: 'center' },
    );

  doc.end();
  return finished;
}
