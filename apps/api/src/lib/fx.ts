/**
 * FX — currency conversion off the ČNB daily fixing (P1 multi-currency).
 *
 * The ČNB publishes a plain-text table once per working day. We parse it, store
 * the latest fixing in `exchange_rates`, and convert minor-unit amounts between
 * CZK (the quote base) and any quoted currency. All conversion goes through CZK.
 *
 * Rounding: converted minor amounts are rounded to the nearest unit (half-up).
 * The parser is pure + unit-tested; the fetch fails soft.
 */

import { sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { AppDb } from '../db';

const CNB_URL =
  'https://www.cnb.cz/en/financial-markets/foreign-exchange-market/central-bank-exchange-rate-fixing/central-bank-exchange-rate-fixing/daily.txt';

export interface CnbRate {
  currency: string;
  amount: number;
  rate: number; // CZK per `amount` units
}

export interface ParsedCnb {
  fixingDate: string; // YYYY-MM-DD
  rates: CnbRate[];
}

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/**
 * Parse the ČNB daily.txt:
 *   06 Jun 2026 #108
 *   Country|Currency|Amount|Code|Rate
 *   EMU|euro|1|EUR|24.567
 *   ...
 * Returns the fixing date + rates. Throws on an unrecognizable header.
 */
export function parseCnbDaily(text: string): ParsedCnb {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0] ?? '';
  const m = /^(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})/.exec(header);
  if (!m) throw new Error('ČNB: unrecognized header');
  const fixingDate = `${m[3]}-${MONTHS[m[2]!] ?? '01'}-${m[1]!.padStart(2, '0')}`;

  const rates: CnbRate[] = [];
  for (const line of lines.slice(2)) {
    const cols = line.split('|');
    if (cols.length < 5) continue;
    const amount = Number(cols[2]);
    const code = (cols[3] ?? '').trim().toUpperCase();
    const rate = Number((cols[4] ?? '').replace(',', '.'));
    if (!/^[A-Z]{3}$/.test(code) || !Number.isFinite(amount) || !Number.isFinite(rate)) continue;
    rates.push({ currency: code, amount, rate });
  }
  return { fixingDate, rates };
}

/**
 * Convert a minor-unit amount between currencies via CZK. `rates` maps a
 * currency to its ČNB row (CZK per `amount` units). CZK is the implicit base
 * (rate 1, amount 1). Returns null when a needed rate is missing.
 */
export function convertMinor(
  amountMinor: bigint,
  from: string,
  to: string,
  rates: Map<string, CnbRate>,
): bigint | null {
  const F = from.toUpperCase();
  const T = to.toUpperCase();
  if (F === T) return amountMinor;

  // CZK value of 1 minor unit of a currency = rate / amount (in CZK per unit).
  const czkPerUnit = (code: string): number | null => {
    if (code === 'CZK') return 1;
    const r = rates.get(code);
    return r ? r.rate / r.amount : null;
  };
  const fromCzk = czkPerUnit(F);
  const toCzk = czkPerUnit(T);
  if (fromCzk == null || toCzk == null) return null;

  // amount(to) = amount(from) × (czkPerUnit(from) / czkPerUnit(to))
  const factor = fromCzk / toCzk;
  const converted = Number(amountMinor) * factor;
  return BigInt(Math.round(converted));
}

/** Load all stored rates into a Map for {@link convertMinor}. */
export async function loadRates(db: AppDb): Promise<Map<string, CnbRate>> {
  const rows = await db
    .select({
      currency: schema.exchangeRates.currency,
      amount: schema.exchangeRates.amount,
      rate: schema.exchangeRates.rate,
    })
    .from(schema.exchangeRates);
  return new Map(rows.map((r) => [r.currency, { currency: r.currency, amount: r.amount, rate: Number(r.rate) }]));
}

/** Fetch the ČNB daily fixing and upsert it. Returns the count or null on error. */
export async function refreshCnbRates(db: AppDb): Promise<{ fixingDate: string; count: number } | null> {
  try {
    const res = await fetch(CNB_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const parsed = parseCnbDaily(await res.text());
    if (parsed.rates.length === 0) return null;
    for (const r of parsed.rates) {
      await db
        .insert(schema.exchangeRates)
        .values({ currency: r.currency, amount: r.amount, rate: String(r.rate), fixingDate: parsed.fixingDate })
        .onConflictDoUpdate({
          target: schema.exchangeRates.currency,
          set: { amount: r.amount, rate: String(r.rate), fixingDate: parsed.fixingDate, updatedAt: dsql`now()` },
        });
    }
    return { fixingDate: parsed.fixingDate, count: parsed.rates.length };
  } catch {
    return null;
  }
}
