/**
 * CSV catalog import — parsing + row mapping per `06-catalog-pim.md` import MVP.
 *
 * Tolerant of real-world merchant files:
 * - delimiter auto-detection (`;` for CZ Excel exports, `,` otherwise)
 * - quoted fields with embedded delimiters/newlines/escaped quotes ("")
 * - BOM, CRLF, blank lines
 * - Czech decimal commas in prices ("599,90")
 *
 * Expected columns (header row, case/diacritics-insensitive):
 *   title* | slug | description | price* | sku | stock | weight_grams |
 *   category | vendor | brand
 * Extra columns are ignored. One row = one product with a default variant.
 */

export interface CsvParseResult {
  header: string[];
  rows: string[][];
  delimiter: string;
}

/** RFC-4180-ish CSV parser with delimiter detection. */
export function parseCsv(input: string): CsvParseResult {
  const text = input.replace(/^﻿/, ''); // strip BOM
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  // Pick the delimiter that splits the header into the most columns
  const delimiter = [';', ',', '\t']
    .map((d) => ({ d, n: firstLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0]!.d;

  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      field = '';
      if (record.some((f) => f.trim() !== '')) records.push(record);
      record = [];
    } else {
      field += ch;
    }
  }
  // trailing record
  record.push(field);
  if (record.some((f) => f.trim() !== '')) records.push(record);

  const [header = [], ...rows] = records;
  return {
    header: header.map((h) => normalizeHeader(h)),
    rows,
    delimiter,
  };
}

/** Normalize header names: lowercase, strip diacritics/spaces → snake. */
export function normalizeHeader(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Column aliases (CZ + EN merchant exports). */
const COLUMN_ALIASES: Record<string, string> = {
  title: 'title',
  nazev: 'title',
  name: 'title',
  slug: 'slug',
  url: 'slug',
  description: 'description',
  popis: 'description',
  price: 'price',
  cena: 'price',
  sku: 'sku',
  kod: 'sku',
  stock: 'stock',
  sklad: 'stock',
  skladem: 'stock',
  quantity: 'stock',
  weight_grams: 'weight_grams',
  hmotnost_g: 'weight_grams',
  weight: 'weight_grams',
  category: 'category',
  kategorie: 'category',
  vendor: 'vendor',
  vyrobce: 'vendor',
  dodavatel: 'vendor',
  brand: 'brand',
  znacka: 'brand',
};

export interface ImportRow {
  title: string;
  slug: string | null;
  description: string | null;
  /** Minor units. */
  priceMinor: bigint;
  sku: string | null;
  stock: number;
  weightGrams: number | null;
  category: string | null;
  vendor: string | null;
  brand: string | null;
}

export class CsvRowError extends Error {
  constructor(
    public readonly line: number,
    message: string,
  ) {
    super(message);
  }
}

/** "599,90" / "599.90" / "599" → minor units. */
export function parsePriceMajor(value: string): bigint | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [major = '0', frac = ''] = normalized.split('.');
  return BigInt(`${major}${frac.padEnd(2, '0')}`);
}

/**
 * Map parsed CSV records to import rows. Throws CsvRowError per bad row —
 * callers collect them and continue (partial imports are fine).
 */
export function mapImportRows(parsed: CsvParseResult): {
  rows: { line: number; row: ImportRow }[];
  errors: { line: number; message: string }[];
} {
  const colIndex = new Map<string, number>();
  parsed.header.forEach((h, idx) => {
    const canonical = COLUMN_ALIASES[h];
    if (canonical && !colIndex.has(canonical)) colIndex.set(canonical, idx);
  });

  if (!colIndex.has('title')) {
    throw new CsvRowError(1, 'Chybí sloupec "title"/"nazev"');
  }
  if (!colIndex.has('price')) {
    throw new CsvRowError(1, 'Chybí sloupec "price"/"cena"');
  }

  const get = (record: string[], col: string): string =>
    (colIndex.has(col) ? (record[colIndex.get(col)!] ?? '') : '').trim();

  const rows: { line: number; row: ImportRow }[] = [];
  const errors: { line: number; message: string }[] = [];

  parsed.rows.forEach((record, idx) => {
    const line = idx + 2; // 1-based + header
    try {
      const title = get(record, 'title');
      if (!title) throw new CsvRowError(line, 'Prázdný název');

      const priceRaw = get(record, 'price');
      const priceMinor = parsePriceMajor(priceRaw);
      if (priceMinor === null) {
        throw new CsvRowError(line, `Neplatná cena "${priceRaw}"`);
      }

      const stockRaw = get(record, 'stock');
      const stock = stockRaw === '' ? 0 : Number(stockRaw);
      if (!Number.isInteger(stock) || stock < 0) {
        throw new CsvRowError(line, `Neplatný sklad "${stockRaw}"`);
      }

      const weightRaw = get(record, 'weight_grams');
      const weightGrams = weightRaw === '' ? null : Number(weightRaw);
      if (weightGrams !== null && (!Number.isInteger(weightGrams) || weightGrams < 0)) {
        throw new CsvRowError(line, `Neplatná hmotnost "${weightRaw}"`);
      }

      rows.push({
        line,
        row: {
          title,
          slug: get(record, 'slug') || null,
          description: get(record, 'description') || null,
          priceMinor,
          sku: get(record, 'sku') || null,
          stock,
          weightGrams,
          category: get(record, 'category') || null,
          vendor: get(record, 'vendor') || null,
          brand: get(record, 'brand') || null,
        },
      });
    } catch (err) {
      errors.push({
        line,
        message: err instanceof CsvRowError ? err.message : String(err),
      });
    }
  });

  return { rows, errors };
}
