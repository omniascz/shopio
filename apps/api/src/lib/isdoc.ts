/**
 * ISDOC 6.0.1 XML generation — per `15-tax-compliance.md` RULE-TAX-021.
 *
 * Pure function: (invoice snapshot + items) → XML string. Deterministic, so
 * the document is generated on demand instead of being stored (the invoice
 * rows are immutable). Namespace `http://isdoc.cz/namespace/2013` covers the
 * 6.x schema family; digital signature (XAdES) is deferred to a later wave.
 *
 * Money: invoice rows are BigInt minor units; ISDOC wants decimal major units
 * with 2 fraction digits (`fmt()` below).
 */

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

/** ISDOC DocumentType: 1 = invoice (faktura), 2 = credit note (dobropis). */
function documentTypeOf(kind: Invoice['kind']): number {
  return kind === 'credit_note' ? 2 : 1;
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Minor units BigInt → "1234.56" decimal string. */
function fmt(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const major = abs / 100n;
  const frac = abs % 100n;
  return `${negative ? '-' : ''}${major}.${String(frac).padStart(2, '0')}`;
}

/** Basis points → "21.00" percent string. */
function pct(basisPoints: number): string {
  return (basisPoints / 100).toFixed(2);
}

function dateOf(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function partyXml(
  tag: 'AccountingSupplierParty' | 'AccountingCustomerParty',
  p: {
    name: string;
    ico?: string | null;
    dic?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country_code?: string | null;
  },
): string {
  const street = [p.line1, p.line2].filter(Boolean).join(', ');
  return `  <${tag}>
    <Party>
      <PartyIdentification>
        <ID>${esc(p.ico ?? '')}</ID>
      </PartyIdentification>
      <PartyName>
        <Name>${esc(p.name)}</Name>
      </PartyName>
      <PostalAddress>
        <StreetName>${esc(street)}</StreetName>
        <BuildingNumber></BuildingNumber>
        <CityName>${esc(p.city ?? '')}</CityName>
        <PostalZone>${esc(p.postal_code ?? '')}</PostalZone>
        <Country>
          <IdentificationCode>${esc(p.country_code ?? 'CZ')}</IdentificationCode>
          <Name></Name>
        </Country>
      </PostalAddress>${
        p.dic
          ? `
      <PartyTaxScheme>
        <CompanyID>${esc(p.dic)}</CompanyID>
        <TaxScheme>VAT</TaxScheme>
      </PartyTaxScheme>`
          : ''
      }
    </Party>
  </${tag}>`;
}

/**
 * Build the ISDOC 6.0.1 document for an issued invoice.
 */
export function buildIsdocXml(invoice: Invoice, items: InvoiceItem[]): string {
  const seller = invoice.sellerSnapshot as unknown as SellerSnapshot;
  const buyer = invoice.buyerSnapshot as unknown as BuyerSnapshot;
  const breakdown = (invoice.taxBreakdown ?? []) as unknown as BreakdownEntry[];
  const isCreditNote = invoice.kind === 'credit_note';

  const lines = items
    .map((it, idx) => {
      const unitNet =
        it.quantity > 0 ? it.netAmount / BigInt(it.quantity) : it.netAmount;
      return `    <InvoiceLine>
      <ID>${idx + 1}</ID>
      <InvoicedQuantity unitCode="${esc(it.unitLabel)}">${it.quantity}</InvoicedQuantity>
      <LineExtensionAmount>${fmt(it.netAmount)}</LineExtensionAmount>
      <LineExtensionAmountTaxInclusive>${fmt(it.grossAmount)}</LineExtensionAmountTaxInclusive>
      <LineExtensionTaxAmount>${fmt(it.taxAmount)}</LineExtensionTaxAmount>
      <UnitPrice>${fmt(unitNet)}</UnitPrice>
      <UnitPriceTaxInclusive>${fmt(it.unitPriceAmount)}</UnitPriceTaxInclusive>
      <ClassifiedTaxCategory>
        <Percent>${pct(it.taxRateBasisPoints)}</Percent>
        <VATCalculationMethod>1</VATCalculationMethod>
      </ClassifiedTaxCategory>
      <Item>
        <Description>${esc(it.title)}</Description>${
          it.sku
            ? `
        <SellersItemIdentification>
          <ID>${esc(it.sku)}</ID>
        </SellersItemIdentification>`
            : ''
        }
      </Item>
    </InvoiceLine>`;
    })
    .join('\n');

  const taxSubTotals = breakdown
    .map((b) => {
      const base = BigInt(b.base_amount);
      const tax = BigInt(b.tax_amount);
      return `    <TaxSubTotal>
      <TaxableAmount>${fmt(base)}</TaxableAmount>
      <TaxAmount>${fmt(tax)}</TaxAmount>
      <TaxInclusiveAmount>${fmt(base + tax)}</TaxInclusiveAmount>
      <AlreadyClaimedTaxableAmount>0.00</AlreadyClaimedTaxableAmount>
      <AlreadyClaimedTaxAmount>0.00</AlreadyClaimedTaxAmount>
      <AlreadyClaimedTaxInclusiveAmount>0.00</AlreadyClaimedTaxInclusiveAmount>
      <DifferenceTaxableAmount>${fmt(base)}</DifferenceTaxableAmount>
      <DifferenceTaxAmount>${fmt(tax)}</DifferenceTaxAmount>
      <DifferenceTaxInclusiveAmount>${fmt(base + tax)}</DifferenceTaxInclusiveAmount>
      <TaxCategory>
        <Percent>${pct(b.rate_basis_points)}</Percent>
      </TaxCategory>
    </TaxSubTotal>`;
    })
    .join('\n');

  const paymentMeansCode = invoice.paymentMethodKind === 'card' ? '48' : '42'; // UN/ECE 4461: 48=card, 42=bank transfer

  return `<?xml version="1.0" encoding="utf-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.1">
  <DocumentType>${documentTypeOf(invoice.kind)}</DocumentType>
  <ID>${esc(invoice.number)}</ID>
  <UUID>${invoice.id}</UUID>
  <IssueDate>${dateOf(invoice.issuedAt)}</IssueDate>
  <TaxPointDate>${dateOf(invoice.taxableSupplyDate)}</TaxPointDate>
  <VATApplicable>${seller.is_vat_payer ? 'true' : 'false'}</VATApplicable>
  <ElectronicPossibilityAgreementReference></ElectronicPossibilityAgreementReference>
  <LocalCurrencyCode>${esc(invoice.currency)}</LocalCurrencyCode>
  <CurrRate>1</CurrRate>
  <RefCurrRate>1</RefCurrRate>${
    isCreditNote && invoice.metadata && (invoice.metadata as { reason?: string }).reason
      ? `
  <Note>${esc((invoice.metadata as { reason?: string }).reason!)}</Note>`
      : ''
  }
${partyXml('AccountingSupplierParty', seller)}
${partyXml('AccountingCustomerParty', {
  ...buyer,
  name: buyer.name ?? buyer.email,
  ico: buyer.registration_number ?? null,
  dic: buyer.vat_id ?? null,
})}
  <InvoiceLines>
${lines}
  </InvoiceLines>
  <TaxTotal>
${taxSubTotals}
    <TaxAmount>${fmt(invoice.taxAmount)}</TaxAmount>
  </TaxTotal>
  <LegalMonetaryTotal>
    <TaxExclusiveAmount>${fmt(invoice.subtotalAmount)}</TaxExclusiveAmount>
    <TaxInclusiveAmount>${fmt(invoice.totalAmount)}</TaxInclusiveAmount>
    <AlreadyClaimedTaxExclusiveAmount>0.00</AlreadyClaimedTaxExclusiveAmount>
    <AlreadyClaimedTaxInclusiveAmount>0.00</AlreadyClaimedTaxInclusiveAmount>
    <DifferenceTaxExclusiveAmount>${fmt(invoice.subtotalAmount)}</DifferenceTaxExclusiveAmount>
    <DifferenceTaxInclusiveAmount>${fmt(invoice.totalAmount)}</DifferenceTaxInclusiveAmount>
    <PayableRoundingAmount>0.00</PayableRoundingAmount>
    <PaidDepositsAmount>0.00</PaidDepositsAmount>
    <PayableAmount>${fmt(invoice.totalAmount)}</PayableAmount>
  </LegalMonetaryTotal>
  <PaymentMeans>
    <Payment>
      <PaidAmount>${fmt(invoice.totalAmount)}</PaidAmount>
      <PaymentMeansCode>${paymentMeansCode}</PaymentMeansCode>
      <Details>
        <PaymentDueDate>${dateOf(invoice.dueDate ?? invoice.issuedAt)}</PaymentDueDate>${
          seller.bank_account_iban
            ? `
        <IBAN>${esc(seller.bank_account_iban)}</IBAN>${
          seller.bank_account_swift
            ? `
        <BIC>${esc(seller.bank_account_swift)}</BIC>`
            : ''
        }`
            : ''
        }${
          invoice.variableSymbol
            ? `
        <VariableSymbol>${esc(invoice.variableSymbol)}</VariableSymbol>`
            : ''
        }
      </Details>
    </Payment>
  </PaymentMeans>
</Invoice>
`;
}
