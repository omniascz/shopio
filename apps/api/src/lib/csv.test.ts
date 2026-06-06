/**
 * CSV import parser tests — delimiter detection, quoting, CZ formats.
 */

import { describe, expect, it } from 'vitest';
import { mapImportRows, normalizeHeader, parseCsv, parsePriceMajor } from './csv';

describe('parseCsv', () => {
  it('parses comma CSV with quotes and embedded delimiters', () => {
    const r = parseCsv('title,price\n"Miska, velká",599\nHrnek,"249,90"\n');
    expect(r.delimiter).toBe(',');
    expect(r.rows).toEqual([
      ['Miska, velká', '599'],
      ['Hrnek', '249,90'],
    ]);
  });

  it('detects semicolon (CZ Excel) delimiter', () => {
    const r = parseCsv('nazev;cena;sklad\nMiska;599,90;10\n');
    expect(r.delimiter).toBe(';');
    expect(r.header).toEqual(['nazev', 'cena', 'sklad']);
  });

  it('handles escaped quotes and CRLF + BOM', () => {
    const r = parseCsv('﻿title,price\r\n"Hrnek ""retro""",100\r\n');
    expect(r.header).toEqual(['title', 'price']);
    expect(r.rows[0]).toEqual(['Hrnek "retro"', '100']);
  });

  it('skips blank lines', () => {
    const r = parseCsv('title,price\n\nA,1\n\n');
    expect(r.rows).toHaveLength(1);
  });
});

describe('normalizeHeader', () => {
  it('strips diacritics and symbols', () => {
    expect(normalizeHeader(' Název ')).toBe('nazev');
    expect(normalizeHeader('Hmotnost (g)')).toBe('hmotnost_g');
  });
});

describe('parsePriceMajor', () => {
  it('handles CZ decimal comma and dot', () => {
    expect(parsePriceMajor('599,90')).toBe(59990n);
    expect(parsePriceMajor('599.9')).toBe(59990n);
    expect(parsePriceMajor('599')).toBe(59900n);
    expect(parsePriceMajor('1 299,00')).toBe(129900n);
  });

  it('rejects garbage', () => {
    expect(parsePriceMajor('abc')).toBeNull();
    expect(parsePriceMajor('1.2.3')).toBeNull();
    expect(parsePriceMajor('-5')).toBeNull();
  });
});

describe('mapImportRows', () => {
  it('maps CZ headers with aliases', () => {
    const parsed = parseCsv(
      'Název;Cena;Sklad;Kód;Kategorie\nMiska modrá;599,90;10;MB-1;Mísy\n',
    );
    const { rows, errors } = mapImportRows(parsed);
    expect(errors).toHaveLength(0);
    expect(rows[0]!.row).toMatchObject({
      title: 'Miska modrá',
      priceMinor: 59990n,
      stock: 10,
      sku: 'MB-1',
      category: 'Mísy',
    });
  });

  it('collects row errors and keeps good rows', () => {
    const parsed = parseCsv('title,price,stock\nOK,100,5\n,200,1\nBad price,xx,1\nNeg,100,-2\n');
    const { rows, errors } = mapImportRows(parsed);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(3);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5]);
  });

  it('throws on missing mandatory columns', () => {
    expect(() => mapImportRows(parseCsv('foo,bar\n1,2\n'))).toThrowError(/title/);
  });
});
