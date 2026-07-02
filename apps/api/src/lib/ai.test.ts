/**
 * AI e-commerce suite — deterministic mock-mode behaviour (no API key).
 * Mirrors the description/SEO mock convention: every task must be fully usable
 * in dev/CI without ANTHROPIC_API_KEY, returning `mock: true`.
 */

import { describe, expect, it } from 'vitest';
import {
  generateAltText,
  generateBulletPoints,
  suggestCategory,
  translateFields,
} from './ai';
import type { ShopioConfig } from '../config';

const config = {} as ShopioConfig; // no ANTHROPIC_API_KEY → mock path

describe('translateFields (mock)', () => {
  it('labels each field with the target language, preserves value', async () => {
    const out = await translateFields(config, {
      fields: { title: 'Keramická miska', description_html: '<p>Ručně dělaná</p>' },
      sourceLocale: 'cs-CZ',
      targetLocale: 'de-DE',
    });
    expect(out.mock).toBe(true);
    expect(out.translations.title).toBe('[DE] Keramická miska');
    expect(out.translations.description_html).toBe('[DE] <p>Ručně dělaná</p>');
  });

  it('skips empty fields', async () => {
    const out = await translateFields(config, {
      fields: { title: 'X', description_html: '' },
      sourceLocale: 'cs-CZ',
      targetLocale: 'en-US',
    });
    expect(Object.keys(out.translations)).toEqual(['title']);
    expect(out.translations.title).toBe('[US] X');
  });
});

describe('suggestCategory (mock)', () => {
  const categories = [
    { id: 'cat_bowls', name: 'Misky', path: 'keramika.misky' },
    { id: 'cat_mugs', name: 'Hrnky', path: 'keramika.hrnky' },
    { id: 'cat_textile', name: 'Textil', path: 'domov.textil' },
  ];

  it('picks the category whose words overlap the product text', async () => {
    const out = await suggestCategory(config, {
      title: 'Keramická miska modrá',
      attributes: { material: 'keramika' },
      categories,
    });
    expect(out.mock).toBe(true);
    expect(out.categoryId).toBe('cat_bowls');
  });

  it('returns null when nothing overlaps', async () => {
    const out = await suggestCategory(config, {
      title: 'Bluetooth reproduktor',
      categories: [{ id: 'cat_bowls', name: 'Misky', path: 'keramika.misky' }],
    });
    expect(out.categoryId).toBeNull();
  });

  it('empty category list → null', async () => {
    const out = await suggestCategory(config, { title: 'cokoliv', categories: [] });
    expect(out.categoryId).toBeNull();
  });
});

describe('generateBulletPoints (mock)', () => {
  it('derives bullets from attributes', async () => {
    const out = await generateBulletPoints(config, {
      title: 'Miska',
      attributes: { Materiál: 'keramika', Objem: '400 ml', Barva: 'modrá' },
      locale: 'cs-CZ',
    });
    expect(out.mock).toBe(true);
    expect(out.bullets).toEqual(['Materiál: keramika', 'Objem: 400 ml', 'Barva: modrá']);
  });

  it('falls back to the title when there are no attributes', async () => {
    const out = await generateBulletPoints(config, { title: 'Miska', locale: 'cs-CZ' });
    expect(out.bullets).toEqual(['Miska']);
  });
});

describe('generateAltText (mock)', () => {
  it('combines title with the first attribute, caps at 125 chars', async () => {
    const out = await generateAltText(config, {
      title: 'Keramická miska',
      attributes: { Barva: 'modrá' },
      locale: 'cs-CZ',
    });
    expect(out.mock).toBe(true);
    expect(out.altText).toBe('Keramická miska – modrá');
  });

  it('uses just the title when no attributes', async () => {
    const out = await generateAltText(config, { title: 'Miska', locale: 'cs-CZ' });
    expect(out.altText).toBe('Miska');
    expect(out.altText.length).toBeLessThanOrEqual(125);
  });
});
