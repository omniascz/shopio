/**
 * ISDOC XML builder tests — shape + money formatting from invoice snapshots.
 */

import { describe, expect, it } from 'vitest';
import { buildIsdocXml } from './isdoc';
import { variableSymbolFor } from './invoices';
import type { schema } from '@shopio/db';

type Invoice = typeof schema.invoices.$inferSelect;
type InvoiceItem = typeof schema.invoiceItems.$inferSelect;

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: '01970000-0000-7000-8000-000000000001',
    tenantId: '01970000-0000-7000-8000-000000000002',
    pubId: 'inv_test1',
    orderId: '01970000-0000-7000-8000-000000000003',
    kind: 'invoice',
    relatedInvoiceId: null,
    number: 'INV-2026-00000042',
    numberSequenceCode: 'INV',
    numberSequencePosition: 42,
    variableSymbol: '2600000042',
    issuedAt: new Date('2026-06-06T10:00:00Z'),
    taxableSupplyDate: '2026-06-06',
    dueDate: '2026-06-06',
    sellerSnapshot: {
      name: 'Bob Ceramics s.r.o.',
      ico: '12345678',
      dic: 'CZ12345678',
      line1: 'Keramická 12',
      line2: null,
      city: 'Praha 7',
      postal_code: '170 00',
      country_code: 'CZ',
      bank_account_iban: 'CZ6508000000192000145399',
      bank_account_swift: 'GIBACZPX',
      is_vat_payer: true,
    },
    buyerSnapshot: {
      name: 'Jan Novák',
      email: 'jan@example.com',
      line1: 'Dlouhá 1',
      line2: null,
      city: 'Brno',
      postal_code: '602 00',
      country_code: 'CZ',
    },
    currency: 'CZK',
    subtotalAmount: 49504n, // 495.04 net
    taxAmount: 10396n, // 103.96 VAT
    totalAmount: 59900n, // 599.00 gross
    taxBreakdown: [
      {
        tax_class: 'standard',
        rate_basis_points: 2100,
        base_amount: '49504',
        tax_amount: '10396',
      },
    ],
    priceIncludesTax: true,
    paymentMethodKind: 'card',
    isVoid: false,
    voidReason: null,
    voidedAt: null,
    createdAt: new Date('2026-06-06T10:00:00Z'),
    updatedAt: new Date('2026-06-06T10:00:00Z'),
    metadata: {},
    ...overrides,
  } as Invoice;
}

function makeItem(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    id: '01970000-0000-7000-8000-000000000010',
    tenantId: '01970000-0000-7000-8000-000000000002',
    invoiceId: '01970000-0000-7000-8000-000000000001',
    position: 0,
    lineKind: 'product',
    sku: 'BCB-L',
    title: 'Černá keramická miska — Velká',
    quantity: 1,
    unitLabel: 'ks',
    unitPriceAmount: 59900n,
    netAmount: 49504n,
    taxClassCode: 'standard',
    taxRateBasisPoints: 2100,
    taxAmount: 10396n,
    grossAmount: 59900n,
    createdAt: new Date('2026-06-06T10:00:00Z'),
    ...overrides,
  } as InvoiceItem;
}

describe('buildIsdocXml', () => {
  it('renders a regular invoice with DocumentType 1 and correct totals', () => {
    const xml = buildIsdocXml(makeInvoice(), [makeItem()]);
    expect(xml).toContain('<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.1">');
    expect(xml).toContain('<DocumentType>1</DocumentType>');
    expect(xml).toContain('<ID>INV-2026-00000042</ID>');
    expect(xml).toContain('<TaxPointDate>2026-06-06</TaxPointDate>');
    expect(xml).toContain('<TaxExclusiveAmount>495.04</TaxExclusiveAmount>');
    expect(xml).toContain('<TaxInclusiveAmount>599.00</TaxInclusiveAmount>');
    expect(xml).toContain('<PayableAmount>599.00</PayableAmount>');
    expect(xml).toContain('<TaxAmount>103.96</TaxAmount>');
    expect(xml).toContain('<Percent>21.00</Percent>');
    expect(xml).toContain('<CompanyID>CZ12345678</CompanyID>');
    expect(xml).toContain('<VariableSymbol>2600000042</VariableSymbol>');
    expect(xml).toContain('<IBAN>CZ6508000000192000145399</IBAN>');
    // Card payment → UN/ECE 4461 code 48
    expect(xml).toContain('<PaymentMeansCode>48</PaymentMeansCode>');
  });

  it('escapes XML special characters in titles', () => {
    const xml = buildIsdocXml(makeInvoice(), [
      makeItem({ title: 'Miska <velká> & "černá"' }),
    ]);
    expect(xml).toContain('Miska &lt;velká&gt; &amp; &quot;černá&quot;');
    expect(xml).not.toContain('<velká>');
  });

  it('renders credit notes with DocumentType 2', () => {
    const xml = buildIsdocXml(
      makeInvoice({ kind: 'credit_note', number: 'CRD-2026-00000001', numberSequenceCode: 'CRD' }),
      [makeItem()],
    );
    expect(xml).toContain('<DocumentType>2</DocumentType>');
    expect(xml).toContain('<ID>CRD-2026-00000001</ID>');
  });

  it('keeps VAT subtotal arithmetic consistent (base + tax = inclusive)', () => {
    const xml = buildIsdocXml(makeInvoice(), [makeItem()]);
    expect(xml).toContain('<TaxableAmount>495.04</TaxableAmount>');
    expect(xml).toContain('<TaxInclusiveAmount>599.00</TaxInclusiveAmount>');
  });

  it('omits PartyTaxScheme for buyers without VAT id (B2C)', () => {
    const xml = buildIsdocXml(makeInvoice(), [makeItem()]);
    // Exactly one CompanyID — the seller's
    expect(xml.match(/<CompanyID>/g)).toHaveLength(1);
  });
});

describe('variableSymbolFor', () => {
  it('builds ≤10-digit symbols from year + position', () => {
    expect(variableSymbolFor(2026, 42)).toBe('2600000042');
    expect(variableSymbolFor(2026, 1)).toBe('2600000001');
    expect(variableSymbolFor(2030, 99999999)).toBe('3099999999');
    expect(variableSymbolFor(2026, 42)).toHaveLength(10);
  });
});
