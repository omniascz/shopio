import { describe, expect, it } from 'vitest';
import {
  decimalStringToMinor,
  fromAllegroOrder,
  minorToDecimalString,
  toAllegroOfferPayload,
  toAllegroPriceCommand,
  toAllegroStockCommand,
} from './mapping';
import type { OfferInput } from './types';

describe('minor ↔ decimal string', () => {
  it('minorToDecimalString', () => {
    expect(minorToDecimalString(12900n)).toBe('129.00');
    expect(minorToDecimalString(5n)).toBe('0.05');
    expect(minorToDecimalString(0n)).toBe('0.00');
    expect(minorToDecimalString(100n)).toBe('1.00');
    expect(minorToDecimalString(-12900n)).toBe('-129.00');
  });
  it('decimalStringToMinor', () => {
    expect(decimalStringToMinor('129.00')).toBe(12900n);
    expect(decimalStringToMinor('129')).toBe(12900n);
    expect(decimalStringToMinor('129.9')).toBe(12990n);
    expect(decimalStringToMinor('0.05')).toBe(5n);
    expect(decimalStringToMinor('-1.5')).toBe(-150n);
    expect(decimalStringToMinor('junk')).toBe(0n);
  });
  it('roundtrips', () => {
    for (const v of [0n, 1n, 99n, 100n, 12345n, 999999n]) {
      expect(decimalStringToMinor(minorToDecimalString(v))).toBe(v);
    }
  });
});

const offer: OfferInput = {
  sku: 'BOWL-01',
  ean: '5901234123457',
  title: 'x'.repeat(120),
  descriptionHtml: '<p>Hezká miska</p>',
  priceMinor: 12900n,
  currency: 'PLN',
  stock: 7,
  images: Array.from({ length: 20 }, (_, i) => `https://img/${i}.jpg`),
  categoryHint: '12345',
};

describe('toAllegroOfferPayload', () => {
  const p = toAllegroOfferPayload(offer) as any;
  it('caps title at 75 chars', () => expect(p.name.length).toBe(75));
  it('maps price to decimal string + currency', () => {
    expect(p.sellingMode.price).toEqual({ amount: '129.00', currency: 'PLN' });
  });
  it('maps stock', () => expect(p.stock).toEqual({ available: 7, unit: 'UNIT' }));
  it('caps images at 16', () => expect(p.images).toHaveLength(16));
  it('maps ean → productSet and sku → external + category', () => {
    expect(p.productSet).toEqual([{ product: { ean: '5901234123457' } }]);
    expect(p.external).toEqual({ id: 'BOWL-01' });
    expect(p.category).toEqual({ id: '12345' });
  });
  it('clamps negative stock to 0', () => {
    expect((toAllegroStockCommand(-4) as any).stock.available).toBe(0);
  });
});

describe('command builders', () => {
  it('price command', () => {
    expect(toAllegroPriceCommand(9990n, 'PLN')).toEqual({
      sellingMode: { price: { amount: '99.90', currency: 'PLN' } },
    });
  });
  it('stock command floors', () => {
    expect(toAllegroStockCommand(3.9)).toEqual({ stock: { available: 3 } });
  });
});

describe('fromAllegroOrder', () => {
  it('normalizes a checkout form', () => {
    const o = fromAllegroOrder({
      id: 'form-123',
      boughtAt: '2026-07-02T10:00:00Z',
      buyer: { email: 'kupujici@allegro.pl' },
      summary: { totalToPay: { amount: '258.00', currency: 'PLN' } },
      lineItems: [
        { offer: { id: 'off-1', external: { id: 'BOWL-01' } }, quantity: 2, price: { amount: '129.00' } },
      ],
    });
    expect(o.externalOrderId).toBe('form-123');
    expect(o.buyerEmail).toBe('kupujici@allegro.pl');
    expect(o.totalMinor).toBe(25800n);
    expect(o.lines).toEqual([
      { externalOfferId: 'off-1', sku: 'BOWL-01', quantity: 2, unitPriceMinor: 12900n },
    ]);
  });
});
