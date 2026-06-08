/**
 * Product feeds for comparison-shopping engines (per `29-integrations.md` +
 * `19-marketing-seo.md`). Heureka.cz / Zboží.cz / Glami all consume a
 * `<SHOP><SHOPITEM>…` XML format with minor per-provider differences. On the CZ
 * market these feeds are the #1 acquisition channel — a shop without a Heureka
 * feed is effectively invisible.
 *
 * MVP scope: outbound XML generated on demand from the live catalog (active
 * products + variants + primary image + category path + VAT). One SHOPITEM per
 * sellable variant; variants of the same product share an ITEMGROUP_ID. No
 * per-feed field mapping UI, no bid management, no Heureka Ověřeno API — those
 * are later `29` slices.
 */

import { and, asc, eq, inArray, isNull, lte, or, gt, desc } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import type { AppDb } from '../db';

export type FeedProvider = 'heureka' | 'zbozi' | 'glami';

interface TenantInfo {
  id: string;
  slug: string;
  countryCode: string;
  defaultCurrency: string;
  priceIncludesTax: boolean;
}

export interface FeedItem {
  variantPubId: string;
  productPubId: string;
  productSlug: string;
  name: string;
  variantTitle: string;
  description: string;
  brand: string | null;
  ean: string | null;
  sku: string | null;
  imageUrl: string | null;
  grossMinor: bigint;
  vatPercent: number;
  currency: string;
  categoryPath: string[];
  hasSiblings: boolean;
  available: boolean;
  params: { name: string; value: string }[];
}

function xmlEscape(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Strip HTML to plain text for feed descriptions (engines reject markup). */
function stripHtml(html: string | null): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Load the catalog rows needed for the feed (active, published products with
 * at least one variant) within the tenant's RLS scope.
 */
export async function loadFeedItems(
  rlsDb: AppDb,
  tenant: TenantInfo,
): Promise<FeedItem[]> {
  return withTenant(rlsDb, tenant.id, async (tx) => {
    // VAT rates for the home country, current ones first (RLS-scoped — must run
    // inside the tenant transaction or the policy filters every row out).
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const rateRows = await tx
      .select({
        taxClassCode: schema.taxRates.taxClassCode,
        rateBasisPoints: schema.taxRates.rateBasisPoints,
      })
      .from(schema.taxRates)
      .where(
        and(
          eq(schema.taxRates.tenantId, tenant.id),
          eq(schema.taxRates.countryCode, tenant.countryCode.toUpperCase()),
          eq(schema.taxRates.isActive, true),
          lte(schema.taxRates.validFrom, today),
          or(isNull(schema.taxRates.validUntil), gt(schema.taxRates.validUntil, today)),
        ),
      )
      .orderBy(desc(schema.taxRates.validFrom));
    const rateByClass = new Map<string, number>();
    for (const r of rateRows) {
      if (!rateByClass.has(r.taxClassCode)) rateByClass.set(r.taxClassCode, r.rateBasisPoints);
    }

    const products = await tx
      .select({
        id: schema.products.id,
        pubId: schema.products.pubId,
        slug: schema.products.slug,
        title: schema.products.title,
        descriptionHtml: schema.products.descriptionHtml,
        brandName: schema.products.brandName,
        vendor: schema.products.vendor,
        taxClassCode: schema.products.taxClassCode,
        attributes: schema.products.attributes,
      })
      .from(schema.products)
      .where(and(eq(schema.products.tenantId, tenant.id), eq(schema.products.status, 'active')));
    if (products.length === 0) return [];

    const productIds = products.map((p) => p.id);

    const variants = await tx
      .select({
        productId: schema.productVariants.productId,
        pubId: schema.productVariants.pubId,
        sku: schema.productVariants.sku,
        barcode: schema.productVariants.barcode,
        title: schema.productVariants.title,
        priceAmount: schema.productVariants.priceAmount,
        priceCurrency: schema.productVariants.priceCurrency,
        stockOnHand: schema.productVariants.stockOnHand,
        stockReserved: schema.productVariants.stockReserved,
        allowBackorder: schema.productVariants.allowBackorder,
      })
      .from(schema.productVariants)
      .where(
        and(
          eq(schema.productVariants.tenantId, tenant.id),
          inArray(schema.productVariants.productId, productIds),
        ),
      )
      .orderBy(asc(schema.productVariants.position));

    const media = await tx
      .select({
        productId: schema.productMedia.productId,
        url: schema.productMedia.url,
        isPrimary: schema.productMedia.isPrimary,
        position: schema.productMedia.position,
      })
      .from(schema.productMedia)
      .where(
        and(
          eq(schema.productMedia.tenantId, tenant.id),
          inArray(schema.productMedia.productId, productIds),
          eq(schema.productMedia.kind, 'image'),
        ),
      )
      .orderBy(asc(schema.productMedia.position));

    const cats = await tx
      .select({
        productId: schema.productCategories.productId,
        name: schema.categories.name,
        depth: schema.categories.depth,
      })
      .from(schema.productCategories)
      .innerJoin(schema.categories, eq(schema.categories.id, schema.productCategories.categoryId))
      .where(eq(schema.productCategories.tenantId, tenant.id));

    // Index image (primary first) + deepest category path per product.
    const imgByProduct = new Map<string, string>();
    for (const m of media) {
      if (!imgByProduct.has(m.productId) || m.isPrimary) imgByProduct.set(m.productId, m.url);
    }
    const catByProduct = new Map<string, { name: string; depth: number }[]>();
    for (const c of cats) {
      const arr = catByProduct.get(c.productId) ?? [];
      arr.push({ name: c.name, depth: c.depth });
      catByProduct.set(c.productId, arr);
    }

    const variantsByProduct = new Map<string, typeof variants>();
    for (const v of variants) {
      const arr = variantsByProduct.get(v.productId) ?? [];
      arr.push(v);
      variantsByProduct.set(v.productId, arr);
    }

    const items: FeedItem[] = [];
    for (const p of products) {
      const pv = variantsByProduct.get(p.id) ?? [];
      if (pv.length === 0) continue;
      const rateBp = rateByClass.get(p.taxClassCode) ?? 0;
      const vatPercent = rateBp / 100;
      const catList = (catByProduct.get(p.id) ?? []).sort((a, b) => a.depth - b.depth).map((c) => c.name);
      const attrs = (p.attributes as Record<string, string> | null) ?? {};
      const params = Object.entries(attrs)
        .filter(([, v]) => typeof v === 'string' && v.length > 0)
        .map(([name, value]) => ({ name, value: String(value) }));

      for (const v of pv) {
        const net = v.priceAmount;
        const grossMinor = tenant.priceIncludesTax
          ? net
          : net + (net * BigInt(rateBp)) / 10000n;
        items.push({
          variantPubId: v.pubId,
          productPubId: p.pubId,
          productSlug: p.slug,
          name: pv.length > 1 ? `${p.title} — ${v.title}` : p.title,
          variantTitle: v.title,
          description: stripHtml(p.descriptionHtml).slice(0, 4000),
          brand: p.brandName ?? p.vendor,
          ean: v.barcode,
          sku: v.sku,
          imageUrl: imgByProduct.get(p.id) ?? null,
          grossMinor,
          vatPercent,
          currency: v.priceCurrency || tenant.defaultCurrency,
          categoryPath: catList,
          hasSiblings: pv.length > 1,
          available: v.allowBackorder || v.stockOnHand - v.stockReserved > 0,
          params,
        });
      }
    }
    return items;
  });
}

function money(minor: bigint): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const whole = abs / 100n;
  const cents = abs % 100n;
  return `${neg ? '-' : ''}${whole}.${cents.toString().padStart(2, '0')}`;
}

/** Build the comparison-shopping XML feed for a provider. */
export function buildFeedXml(
  provider: FeedProvider,
  items: FeedItem[],
  storefrontBase: string,
  tenantSlug: string,
): string {
  const shopBase = `${storefrontBase.replace(/\/$/, '')}/s/${tenantSlug}`;
  const catPrefix = provider === 'heureka' ? 'Heureka.cz | ' : '';

  const body = items
    .map((it) => {
      const url = `${shopBase}/p/${it.productSlug}`;
      const lines: string[] = [];
      lines.push(`    <ITEM_ID>${xmlEscape(it.variantPubId)}</ITEM_ID>`);
      if (it.hasSiblings) lines.push(`    <ITEMGROUP_ID>${xmlEscape(it.productPubId)}</ITEMGROUP_ID>`);
      lines.push(`    <PRODUCTNAME>${xmlEscape(it.name)}</PRODUCTNAME>`);
      lines.push(`    <PRODUCT>${xmlEscape(it.name)}</PRODUCT>`);
      if (it.description) lines.push(`    <DESCRIPTION>${xmlEscape(it.description)}</DESCRIPTION>`);
      lines.push(`    <URL>${xmlEscape(url)}</URL>`);
      if (it.imageUrl) lines.push(`    <IMGURL>${xmlEscape(it.imageUrl)}</IMGURL>`);
      lines.push(`    <PRICE_VAT>${money(it.grossMinor)}</PRICE_VAT>`);
      if (provider === 'heureka') lines.push(`    <VAT>${it.vatPercent}%</VAT>`);
      if (it.brand) lines.push(`    <MANUFACTURER>${xmlEscape(it.brand)}</MANUFACTURER>`);
      if (it.categoryPath.length > 0) {
        lines.push(`    <CATEGORYTEXT>${xmlEscape(catPrefix + it.categoryPath.join(' | '))}</CATEGORYTEXT>`);
      }
      if (it.ean) lines.push(`    <EAN>${xmlEscape(it.ean)}</EAN>`);
      if (it.sku) lines.push(`    <PRODUCTNO>${xmlEscape(it.sku)}</PRODUCTNO>`);
      lines.push(`    <DELIVERY_DATE>0</DELIVERY_DATE>`);
      for (const param of it.params) {
        lines.push(
          `    <PARAM><PARAM_NAME>${xmlEscape(param.name)}</PARAM_NAME><VAL>${xmlEscape(param.value)}</VAL></PARAM>`,
        );
      }
      return `  <SHOPITEM>\n${lines.join('\n')}\n  </SHOPITEM>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>\n<SHOP>\n${body}\n</SHOP>\n`;
}

/**
 * Google Shopping / Google Merchant feed — RSS 2.0 with the `g:` namespace.
 * The global comparison/ads standard; also the base for Free Listings + AI
 * shopping surfaces.
 */
export function buildGoogleFeed(items: FeedItem[], storefrontBase: string, tenantSlug: string): string {
  const shopBase = `${storefrontBase.replace(/\/$/, '')}/s/${tenantSlug}`;
  const body = items
    .map((it) => {
      const url = `${shopBase}/p/${it.productSlug}`;
      const lines: string[] = [];
      lines.push(`      <g:id>${xmlEscape(it.variantPubId)}</g:id>`);
      lines.push(`      <title>${xmlEscape(it.name)}</title>`);
      if (it.description) lines.push(`      <description>${xmlEscape(it.description)}</description>`);
      lines.push(`      <link>${xmlEscape(url)}</link>`);
      if (it.imageUrl) lines.push(`      <g:image_link>${xmlEscape(it.imageUrl)}</g:image_link>`);
      lines.push(`      <g:price>${money(it.grossMinor)} ${it.currency}</g:price>`);
      lines.push(`      <g:availability>${it.available ? 'in_stock' : 'out_of_stock'}</g:availability>`);
      if (it.brand) lines.push(`      <g:brand>${xmlEscape(it.brand)}</g:brand>`);
      if (it.ean) lines.push(`      <g:gtin>${xmlEscape(it.ean)}</g:gtin>`);
      if (it.sku) lines.push(`      <g:mpn>${xmlEscape(it.sku)}</g:mpn>`);
      if (it.hasSiblings) lines.push(`      <g:item_group_id>${xmlEscape(it.productPubId)}</g:item_group_id>`);
      if (it.categoryPath.length > 0) {
        lines.push(`      <g:product_type>${xmlEscape(it.categoryPath.join(' > '))}</g:product_type>`);
      }
      lines.push(`      <g:condition>new</g:condition>`);
      return `    <item>\n${lines.join('\n')}\n    </item>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEscape(tenantSlug)}</title>
    <link>${xmlEscape(shopBase)}</link>
${body}
  </channel>
</rss>
`;
}

/**
 * Ceneo.pl feed — the dominant Polish price-comparison engine (PL must-have).
 * `<offers><o>…</o></offers>` format.
 */
export function buildCeneoFeed(items: FeedItem[], storefrontBase: string, tenantSlug: string): string {
  const shopBase = `${storefrontBase.replace(/\/$/, '')}/s/${tenantSlug}`;
  const body = items
    .map((it) => {
      const url = `${shopBase}/p/${it.productSlug}`;
      const cat = it.categoryPath.join('/');
      const attrs = it.params
        .map((p) => `        <a name="${xmlEscape(p.name)}">${xmlEscape(p.value)}</a>`)
        .join('\n');
      return `    <o id="${xmlEscape(it.variantPubId)}" url="${xmlEscape(url)}" price="${money(it.grossMinor)}" avail="${it.available ? '1' : '0'}" stock="${it.available ? '1' : '0'}"${it.ean ? ` ean="${xmlEscape(it.ean)}"` : ''}>
      <cat><![CDATA[${cat}]]></cat>
      <name><![CDATA[${it.name}]]></name>
      ${it.imageUrl ? `<imgs><main url="${xmlEscape(it.imageUrl)}"/></imgs>` : ''}
      <desc><![CDATA[${it.description}]]></desc>
      <attrs>
${it.brand ? `        <a name="Producent">${xmlEscape(it.brand)}</a>\n` : ''}${attrs}
      </attrs>
    </o>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<offers version="1">\n${body}\n</offers>\n`;
}

/**
 * AI / agentic-commerce product feed (per the 2026 trend) — a clean structured
 * JSON catalog that LLM shopping agents (ChatGPT, Gemini, Perplexity, Copilot)
 * and the storefront's llms.txt can consume. Real-time price + availability;
 * the open-feed counterpart to Shopify's agentic Catalog.
 */
export function buildAiFeed(items: FeedItem[], storefrontBase: string, tenantSlug: string, shopName: string): string {
  const shopBase = `${storefrontBase.replace(/\/$/, '')}/s/${tenantSlug}`;
  return JSON.stringify(
    {
      shop: { name: shopName, url: shopBase },
      generated_at: null, // stamped by the caller if needed
      products: items.map((it) => ({
        id: it.variantPubId,
        group_id: it.hasSiblings ? it.productPubId : undefined,
        name: it.name,
        description: it.description || undefined,
        url: `${shopBase}/p/${it.productSlug}`,
        image: it.imageUrl || undefined,
        brand: it.brand || undefined,
        gtin: it.ean || undefined,
        sku: it.sku || undefined,
        price: { amount: money(it.grossMinor), currency: it.currency, includes_tax: true },
        availability: it.available ? 'in_stock' : 'out_of_stock',
        category: it.categoryPath.length ? it.categoryPath.join(' > ') : undefined,
        attributes: it.params.length
          ? Object.fromEntries(it.params.map((p) => [p.name, p.value]))
          : undefined,
      })),
    },
    null,
    2,
  );
}
