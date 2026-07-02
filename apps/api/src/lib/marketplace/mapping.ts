/**
 * Pure Allegro payload mappers (unit-tested). Kept separate from the HTTP
 * adapter so the shape logic is verifiable without credentials or a network.
 *
 * Allegro prices are decimal strings ("129.00"); Shopio stores minor units
 * (bigint). Allegro offer titles are capped at 75 chars.
 */

import type { ExternalOrder, OfferInput } from './types';

const ALLEGRO_TITLE_MAX = 75;
const ALLEGRO_MAX_IMAGES = 16;

/** 12900n → "129.00" (2 decimal places, sign-preserving). */
export function minorToDecimalString(minor: bigint): string {
  const neg = minor < 0n;
  const abs = (neg ? -minor : minor).toString().padStart(3, '0');
  const whole = abs.slice(0, -2);
  const frac = abs.slice(-2);
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

/** "129.00" / "129" / "129.9" → 12900n (minor units, rounded to 2dp). */
export function decimalStringToMinor(s: string): bigint {
  const m = String(s).trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!m) return 0n;
  const sign = m[1] === '-' ? -1n : 1n;
  const whole = BigInt(m[2]!);
  const fracRaw = (m[3] ?? '').padEnd(2, '0').slice(0, 2);
  return sign * (whole * 100n + BigInt(fracRaw || '0'));
}

/** Shopio offer → Allegro product-offer create payload (subset). */
export function toAllegroOfferPayload(input: OfferInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: input.title.slice(0, ALLEGRO_TITLE_MAX),
    sellingMode: {
      format: 'BUY_NOW',
      price: { amount: minorToDecimalString(input.priceMinor), currency: input.currency },
    },
    stock: { available: Math.max(0, Math.floor(input.stock)), unit: 'UNIT' },
    images: input.images.slice(0, ALLEGRO_MAX_IMAGES).map((url) => ({ url })),
    description: {
      sections: [
        { items: [{ type: 'TEXT', content: input.descriptionHtml || `<p>${input.title}</p>` }] },
      ],
    },
  };
  if (input.ean) payload.productSet = [{ product: { ean: input.ean } }];
  if (input.categoryHint) payload.category = { id: input.categoryHint };
  if (input.sku) payload.external = { id: input.sku };
  return payload;
}

/** Partial PATCH body to change an offer's price. */
export function toAllegroPriceCommand(priceMinor: bigint, currency: string): Record<string, unknown> {
  return { sellingMode: { price: { amount: minorToDecimalString(priceMinor), currency } } };
}

/** Partial PATCH body to change an offer's stock. */
export function toAllegroStockCommand(stock: number): Record<string, unknown> {
  return { stock: { available: Math.max(0, Math.floor(stock)) } };
}

/** Allegro checkout-form → normalized ExternalOrder. */
export function fromAllegroOrder(form: {
  id: string;
  boughtAt?: string;
  updatedAt?: string;
  buyer?: { email?: string | null };
  summary?: { totalToPay?: { amount?: string; currency?: string } };
  lineItems?: Array<{ offer?: { id?: string; external?: { id?: string } }; quantity?: number; price?: { amount?: string } }>;
}): ExternalOrder {
  const currency = form.summary?.totalToPay?.currency ?? 'PLN';
  const lines = (form.lineItems ?? []).map((li) => ({
    externalOfferId: li.offer?.id ?? '',
    sku: li.offer?.external?.id ?? null,
    quantity: li.quantity ?? 0,
    unitPriceMinor: decimalStringToMinor(li.price?.amount ?? '0'),
  }));
  return {
    externalOrderId: form.id,
    placedAt: form.boughtAt ?? form.updatedAt ?? '',
    currency,
    buyerEmail: form.buyer?.email ?? null,
    totalMinor: decimalStringToMinor(form.summary?.totalToPay?.amount ?? '0'),
    lines,
  };
}
