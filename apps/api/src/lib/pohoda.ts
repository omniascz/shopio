/**
 * Pohoda XML export (per `29-integrations.md` + `15-tax-compliance.md`).
 *
 * Generates a Stormware Pohoda `dataPack` of issued invoices + credit notes
 * that the merchant imports into Pohoda accounting (Soubor → Datová komunikace
 * → XML import). The #2 CZ adoption requirement after Heureka — every CZ
 * merchant runs Pohoda or iDoklad.
 *
 * MVP scope: outbound one-way export of issued documents in a date range. No
 * bidirectional sync, no stock/customer sync, no Pohoda mServer push — those
 * are later `29` slices. UTF-8 output (Pohoda accepts it when declared).
 */

type Snapshot = {
  name?: string | null;
  email?: string | null;
  ico?: string | null;
  registration_number?: string | null;
  dic?: string | null;
  vat_id?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
};

export interface PohodaInvoice {
  number: string;
  kind: 'invoice' | 'credit_note';
  variableSymbol: string | null;
  issuedAt: Date;
  dueAt: Date | null;
  taxPointAt: Date | null;
  currency: string;
  sellerSnapshot: Snapshot;
  buyerSnapshot: Snapshot;
  priceIncludesTax: boolean;
  items: {
    title: string;
    quantity: number;
    unitLabel: string;
    netAmount: bigint;
    taxAmount: bigint;
    grossAmount: bigint;
    taxRateBasisPoints: number;
  }[];
}

function esc(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Minor units → "1234.56". */
function money(minor: bigint): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  return `${neg ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** CZ VAT rate (basis points) → Pohoda rateVAT code. */
function rateVat(bp: number): 'high' | 'low' | 'none' {
  if (bp >= 2000) return 'high'; // 21 %
  if (bp > 0) return 'low'; // 12 % (and legacy 15 %)
  return 'none';
}

function addressXml(p: Snapshot): string {
  const street = [p.line1, p.line2].filter(Boolean).join(', ');
  const company = p.name ?? p.email ?? '';
  const ico = p.ico ?? p.registration_number ?? '';
  const dic = p.dic ?? p.vat_id ?? '';
  return `        <typ:address>
          <typ:company>${esc(company)}</typ:company>${
            ico ? `\n          <typ:ico>${esc(ico)}</typ:ico>` : ''
          }${dic ? `\n          <typ:dic>${esc(dic)}</typ:dic>` : ''}
          <typ:street>${esc(street)}</typ:street>
          <typ:city>${esc(p.city ?? '')}</typ:city>
          <typ:zip>${esc(p.postal_code ?? '')}</typ:zip>
          <typ:country><typ:ids>${esc(p.country_code ?? 'CZ')}</typ:ids></typ:country>
        </typ:address>`;
}

function invoiceItemXml(it: PohodaInvoice['items'][number]): string {
  // Pohoda unit price: net for VAT-exclusive, gross for VAT-inclusive shops.
  const unitNet = it.quantity > 0 ? it.netAmount / BigInt(it.quantity) : it.netAmount;
  return `        <inv:invoiceItem>
          <inv:text>${esc(it.title)}</inv:text>
          <inv:quantity>${it.quantity}</inv:quantity>
          <inv:unit>${esc(it.unitLabel)}</inv:unit>
          <inv:rateVAT>${rateVat(it.taxRateBasisPoints)}</inv:rateVAT>
          <inv:homeCurrency>
            <typ:unitPrice>${money(unitNet)}</typ:unitPrice>
            <typ:price>${money(it.netAmount)}</typ:price>
            <typ:priceVAT>${money(it.taxAmount)}</typ:priceVAT>
          </inv:homeCurrency>
        </inv:invoiceItem>`;
}

function invoiceXml(inv: PohodaInvoice): string {
  const isCredit = inv.kind === 'credit_note';
  const invoiceType = isCredit ? 'issuedCreditNotice' : 'issuedInvoice';
  return `  <dat:dataPackItem version="2.0" id="${esc(inv.number)}">
    <inv:invoice version="2.0">
      <inv:invoiceHeader>
        <inv:invoiceType>${invoiceType}</inv:invoiceType>
        <inv:number><typ:numberRequested>${esc(inv.number)}</typ:numberRequested></inv:number>${
          inv.variableSymbol ? `\n        <inv:symVar>${esc(inv.variableSymbol)}</inv:symVar>` : ''
        }
        <inv:date>${dateStr(inv.issuedAt)}</inv:date>${
          inv.taxPointAt ? `\n        <inv:dateTax>${dateStr(inv.taxPointAt)}</inv:dateTax>` : ''
        }${inv.dueAt ? `\n        <inv:dateDue>${dateStr(inv.dueAt)}</inv:dateDue>` : ''}
        <inv:text>Objednávka ${esc(inv.number)}</inv:text>
        <inv:partnerIdentity>
${addressXml(inv.buyerSnapshot)}
        </inv:partnerIdentity>
      </inv:invoiceHeader>
      <inv:invoiceDetail>
${inv.items.map(invoiceItemXml).join('\n')}
      </inv:invoiceDetail>
      <inv:invoiceSummary>
        <inv:homeCurrency>
          <inv:priceHighSum>${money(
            inv.items.filter((i) => rateVat(i.taxRateBasisPoints) === 'high').reduce((s, i) => s + i.netAmount, 0n),
          )}</inv:priceHighSum>
          <inv:priceHighVAT>${money(
            inv.items.filter((i) => rateVat(i.taxRateBasisPoints) === 'high').reduce((s, i) => s + i.taxAmount, 0n),
          )}</inv:priceHighVAT>
          <inv:priceLowSum>${money(
            inv.items.filter((i) => rateVat(i.taxRateBasisPoints) === 'low').reduce((s, i) => s + i.netAmount, 0n),
          )}</inv:priceLowSum>
          <inv:priceLowVAT>${money(
            inv.items.filter((i) => rateVat(i.taxRateBasisPoints) === 'low').reduce((s, i) => s + i.taxAmount, 0n),
          )}</inv:priceLowVAT>
          <inv:priceNone>${money(
            inv.items.filter((i) => rateVat(i.taxRateBasisPoints) === 'none').reduce((s, i) => s + i.netAmount, 0n),
          )}</inv:priceNone>
        </inv:homeCurrency>
      </inv:invoiceSummary>
    </inv:invoice>
  </dat:dataPackItem>`;
}

/** Build the full Pohoda dataPack for a set of invoices. */
export function buildPohodaDataPack(invoices: PohodaInvoice[], ico: string): string {
  const items = invoices.map((inv) => invoiceXml(inv)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<dat:dataPack version="2.0" id="Shopio" ico="${esc(ico)}" application="Shopio" note="Export faktur"
  xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd"
  xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd"
  xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd">
${items}
</dat:dataPack>
`;
}
