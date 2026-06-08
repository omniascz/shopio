/**
 * Builder tests for the extended feed set (per `29-integrations.md`):
 * Google Shopping (RSS + g:), Ceneo (PL), and the AI/agentic JSON feed.
 */

import { describe, expect, it } from 'vitest';
import { buildAiFeed, buildCeneoFeed, buildGoogleFeed, type FeedItem } from './feeds';

const BASE = 'https://shopio.test';
const SLUG = 'demo';

function item(over: Partial<FeedItem> = {}): FeedItem {
  return {
    variantPubId: 'var_1',
    productPubId: 'prod_1',
    productSlug: 'blue-shirt',
    name: 'Blue Shirt',
    variantTitle: 'M',
    description: 'A nice shirt',
    brand: 'Acme',
    ean: '1234567890123',
    sku: 'SKU-1',
    imageUrl: 'https://img.test/1.jpg',
    grossMinor: 49900n,
    vatPercent: 21,
    currency: 'CZK',
    categoryPath: ['Oblečení', 'Trička'],
    hasSiblings: true,
    available: true,
    params: [{ name: 'Velikost', value: 'M' }],
    ...over,
  };
}

describe('buildGoogleFeed', () => {
  it('emits RSS 2.0 with the g: namespace and required fields', () => {
    const xml = buildGoogleFeed([item()], BASE, SLUG);
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain('<g:id>var_1</g:id>');
    expect(xml).toContain('<g:price>499.00 CZK</g:price>');
    expect(xml).toContain('<g:availability>in_stock</g:availability>');
    expect(xml).toContain('<g:gtin>1234567890123</g:gtin>');
    expect(xml).toContain('<g:item_group_id>prod_1</g:item_group_id>');
    expect(xml).toContain(`${BASE}/s/${SLUG}/p/blue-shirt`);
  });

  it('maps out-of-stock availability', () => {
    const xml = buildGoogleFeed([item({ available: false })], BASE, SLUG);
    expect(xml).toContain('<g:availability>out_of_stock</g:availability>');
  });
});

describe('buildCeneoFeed', () => {
  it('emits offers/o with price, avail and attrs', () => {
    const xml = buildCeneoFeed([item()], BASE, SLUG);
    expect(xml).toContain('<offers version="1">');
    expect(xml).toContain('price="499.00"');
    expect(xml).toContain('avail="1"');
    expect(xml).toContain('ean="1234567890123"');
    expect(xml).toContain('<a name="Producent">Acme</a>');
    expect(xml).toContain('<a name="Velikost">M</a>');
  });
});

describe('buildAiFeed', () => {
  it('emits structured JSON for agents', () => {
    const json = JSON.parse(buildAiFeed([item()], BASE, SLUG, 'Demo Shop'));
    expect(json.shop.name).toBe('Demo Shop');
    expect(json.products).toHaveLength(1);
    const p = json.products[0];
    expect(p.id).toBe('var_1');
    expect(p.group_id).toBe('prod_1');
    expect(p.price).toEqual({ amount: '499.00', currency: 'CZK', includes_tax: true });
    expect(p.availability).toBe('in_stock');
    expect(p.attributes).toEqual({ Velikost: 'M' });
  });

  it('omits group_id when no siblings', () => {
    const json = JSON.parse(buildAiFeed([item({ hasSiblings: false })], BASE, SLUG, 'Demo'));
    expect(json.products[0].group_id).toBeUndefined();
  });
});
