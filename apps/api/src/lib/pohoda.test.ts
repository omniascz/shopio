/**
 * Pohoda dataPack export tests (per `29-integrations.md`).
 */

import { describe, expect, it } from 'vitest';
import { buildPohodaDataPack, type PohodaInvoice } from './pohoda';

const sample: PohodaInvoice = {
  number: 'INV-2026-00000001',
  kind: 'invoice',
  variableSymbol: '20260001',
  issuedAt: new Date('2026-06-08T10:00:00Z'),
  dueAt: null,
  taxPointAt: null,
  currency: 'CZK',
  sellerSnapshot: { name: 'Bob Ceramics s.r.o.', ico: '12345678', dic: 'CZ12345678' },
  buyerSnapshot: {
    name: 'Jan Novák',
    email: 'jan@example.com',
    line1: 'Dlouhá 1',
    city: 'Praha',
    postal_code: '11000',
    country_code: 'CZ',
  },
  priceIncludesTax: true,
  items: [
    {
      title: 'Talíř hluboký',
      quantity: 2,
      unitLabel: 'ks',
      netAmount: 20000n,
      taxAmount: 4200n,
      grossAmount: 24200n,
      taxRateBasisPoints: 2100,
    },
    {
      title: 'Kniha receptů',
      quantity: 1,
      unitLabel: 'ks',
      netAmount: 10000n,
      taxAmount: 1200n,
      grossAmount: 11200n,
      taxRateBasisPoints: 1200,
    },
  ],
};

describe('buildPohodaDataPack', () => {
  const xml = buildPohodaDataPack([sample], '12345678');

  it('emits a valid dataPack root with the company ICO', () => {
    expect(xml).toContain('<dat:dataPack');
    expect(xml).toContain('ico="12345678"');
    expect(xml).toContain('xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd"');
  });

  it('marks an issued invoice + its number + variable symbol', () => {
    expect(xml).toContain('<inv:invoiceType>issuedInvoice</inv:invoiceType>');
    expect(xml).toContain('<typ:numberRequested>INV-2026-00000001</typ:numberRequested>');
    expect(xml).toContain('<inv:symVar>20260001</inv:symVar>');
  });

  it('maps VAT rates to Pohoda codes (21%→high, 12%→low)', () => {
    expect(xml).toContain('<inv:rateVAT>high</inv:rateVAT>');
    expect(xml).toContain('<inv:rateVAT>low</inv:rateVAT>');
  });

  it('splits the VAT summary by rate', () => {
    expect(xml).toContain('<inv:priceHighSum>200.00</inv:priceHighSum>');
    expect(xml).toContain('<inv:priceHighVAT>42.00</inv:priceHighVAT>');
    expect(xml).toContain('<inv:priceLowSum>100.00</inv:priceLowSum>');
    expect(xml).toContain('<inv:priceLowVAT>12.00</inv:priceLowVAT>');
  });

  it('includes the buyer address', () => {
    expect(xml).toContain('<typ:company>Jan Novák</typ:company>');
    expect(xml).toContain('<typ:city>Praha</typ:city>');
    expect(xml).toContain('<typ:zip>11000</typ:zip>');
  });

  it('marks credit notes as issuedCreditNotice', () => {
    const credit = buildPohodaDataPack(
      [{ ...sample, kind: 'credit_note', number: 'CRD-2026-00000001' }],
      '12345678',
    );
    expect(credit).toContain('<inv:invoiceType>issuedCreditNotice</inv:invoiceType>');
  });
});
