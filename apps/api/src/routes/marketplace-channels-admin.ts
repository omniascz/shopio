/**
 * Admin marketplace channels (BaseLinker-style external sync).
 *
 *   GET  /admin/marketplace/catalog                     — available platforms
 *   GET  /admin/marketplace/channels
 *   POST /admin/marketplace/channels                    — connect a channel
 *   GET  /admin/marketplace/channels/:pubId/listings
 *   POST /admin/marketplace/channels/:pubId/listings    — list a variant (offer)
 *   POST /admin/marketplace/listings/:id/sync           — push current price+stock
 *
 * The `mock` platform runs the whole flow with no credentials. `allegro` needs
 * an OAuth token; without one, list/sync return 409 CHANNEL_NOT_CONNECTED and
 * mark the listing `error` (no crash).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { schema, withTenant, type TenantTx } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import {
  MARKETPLACE_CATALOG,
  MarketplaceNotConfiguredError,
  getMarketplaceConnector,
  type OfferInput,
} from '../lib/marketplace/registry';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const ChannelBody = z.object({
  platform: z.enum(['allegro', 'mock']),
  name: z.string().min(1).max(120),
});
const ListingBody = z.object({ variant: z.string().min(1) });

export async function registerMarketplaceChannelAdminRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const rlsDb = getRlsDb(opts.config);
  const guard = { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] };

  app.get('/api/2026-05-20/admin/marketplace/catalog', guard, async (_req, reply) => {
    return reply.send({ data: { platforms: MARKETPLACE_CATALOG } });
  });

  app.get('/api/2026-05-20/admin/marketplace/channels', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select()
        .from(schema.marketplaceChannels)
        .where(eq(schema.marketplaceChannels.tenantId, tenantId))
        .orderBy(desc(schema.marketplaceChannels.createdAt)),
    );
    return reply.send({ data: { channels: rows.map(serializeChannel) } });
  });

  app.post('/api/2026-05-20/admin/marketplace/channels', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = ChannelBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const [row] = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .insert(schema.marketplaceChannels)
        .values({
          tenantId,
          pubId: generatePubId('mch'),
          platform: i.platform,
          name: i.name,
          // Mock is usable immediately; a real platform stays disconnected
          // until its OAuth token is stored (next increment).
          status: i.platform === 'mock' ? 'connected' : 'disconnected',
        })
        .returning(),
    );
    return reply.code(201).send({ data: serializeChannel(row!) });
  });

  app.get<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/marketplace/channels/:pubId/listings',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const result = await withTenant(rlsDb, tenantId, async (tx) => {
        const ch = await findChannel(tx, tenantId, req.params.pubId);
        if (!ch) return null;
        return tx
          .select()
          .from(schema.marketplaceListings)
          .where(eq(schema.marketplaceListings.channelId, ch.id))
          .orderBy(desc(schema.marketplaceListings.createdAt));
      });
      if (!result) return notFound(reply, 'CHANNEL_NOT_FOUND');
      return reply.send({ data: { listings: result.map(serializeListing) } });
    },
  );

  app.post<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/marketplace/channels/:pubId/listings',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const parsed = ListingBody.safeParse(req.body);
      if (!parsed.success) return validationErr(reply, parsed.error);

      const prep = await withTenant(rlsDb, tenantId, async (tx) => {
        const ch = await findChannel(tx, tenantId, req.params.pubId);
        if (!ch) return { error: 'CHANNEL_NOT_FOUND' as const };
        const offer = await buildOfferInput(tx, tenantId, parsed.data.variant);
        if (!offer) return { error: 'VARIANT_NOT_FOUND' as const };
        return { ch, offer };
      });
      if ('error' in prep) return notFound(reply, prep.error);
      const { ch, offer } = prep;

      const connector = getMarketplaceConnector(ch.platform, {});
      try {
        const res = await connector.listOffer(offer.input);
        await withTenant(rlsDb, tenantId, (tx) =>
          upsertListing(tx, {
            tenantId,
            channelId: ch.id,
            variantId: offer.variantId,
            externalOfferId: res.externalOfferId,
            status: res.status === 'error' ? 'error' : 'active',
            priceAmount: offer.input.priceMinor,
            stock: offer.input.stock,
            listedNow: true,
          }),
        );
        return reply.send({ data: { external_offer_id: res.externalOfferId, status: res.status } });
      } catch (err) {
        await withTenant(rlsDb, tenantId, (tx) =>
          upsertListing(tx, {
            tenantId,
            channelId: ch.id,
            variantId: offer.variantId,
            status: 'error',
            priceAmount: offer.input.priceMinor,
            stock: offer.input.stock,
            lastError: err instanceof Error ? err.message : String(err),
          }),
        );
        if (err instanceof MarketplaceNotConfiguredError) {
          return reply.code(409).send({ error: { code: 'CHANNEL_NOT_CONNECTED', message: err.message } });
        }
        throw err;
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/2026-05-20/admin/marketplace/listings/:id/sync',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);

      const prep = await withTenant(rlsDb, tenantId, async (tx) => {
        const [listing] = await tx
          .select()
          .from(schema.marketplaceListings)
          .where(and(eq(schema.marketplaceListings.tenantId, tenantId), eq(schema.marketplaceListings.id, req.params.id)))
          .limit(1);
        if (!listing) return { error: 'LISTING_NOT_FOUND' as const };
        if (!listing.externalOfferId) return { error: 'LISTING_NOT_LISTED' as const };
        const [ch] = await tx
          .select({ platform: schema.marketplaceChannels.platform })
          .from(schema.marketplaceChannels)
          .where(eq(schema.marketplaceChannels.id, listing.channelId))
          .limit(1);
        const [v] = await tx
          .select({ price: schema.productVariants.priceAmount, currency: schema.productVariants.priceCurrency, stock: schema.productVariants.stockOnHand })
          .from(schema.productVariants)
          .where(eq(schema.productVariants.id, listing.variantId))
          .limit(1);
        if (!ch || !v) return { error: 'LISTING_NOT_FOUND' as const };
        return { listing, platform: ch.platform, price: v.price, currency: v.currency, stock: v.stock };
      });
      if ('error' in prep) {
        return reply.code(prep.error === 'LISTING_NOT_LISTED' ? 409 : 404).send({ error: { code: prep.error, message: prep.error } });
      }

      const connector = getMarketplaceConnector(prep.platform, {});
      try {
        await connector.updateStock(prep.listing.externalOfferId!, prep.stock);
        await connector.updatePrice(prep.listing.externalOfferId!, prep.price, prep.currency);
        await withTenant(rlsDb, tenantId, (tx) =>
          tx
            .update(schema.marketplaceListings)
            .set({ lastStock: prep.stock, lastPriceAmount: prep.price, lastError: null, updatedAt: new Date() })
            .where(eq(schema.marketplaceListings.id, prep.listing.id)),
        );
        return reply.send({ data: { synced: true, stock: prep.stock, price_amount: prep.price.toString() } });
      } catch (err) {
        if (err instanceof MarketplaceNotConfiguredError) {
          return reply.code(409).send({ error: { code: 'CHANNEL_NOT_CONNECTED', message: err.message } });
        }
        throw err;
      }
    },
  );
}

// ----------------------------------------------------------------------- helpers
async function findChannel(
  tx: TenantTx,
  tenantId: string,
  pubId: string,
): Promise<{ id: string; platform: string } | undefined> {
  const [c] = await tx
    .select({ id: schema.marketplaceChannels.id, platform: schema.marketplaceChannels.platform })
    .from(schema.marketplaceChannels)
    .where(and(eq(schema.marketplaceChannels.tenantId, tenantId), eq(schema.marketplaceChannels.pubId, pubId)))
    .limit(1);
  return c;
}

async function buildOfferInput(
  tx: TenantTx,
  tenantId: string,
  variantPubId: string,
): Promise<{ variantId: string; input: OfferInput } | null> {
  const [v] = await tx
    .select({
      id: schema.productVariants.id,
      productId: schema.productVariants.productId,
      sku: schema.productVariants.sku,
      barcode: schema.productVariants.barcode,
      price: schema.productVariants.priceAmount,
      currency: schema.productVariants.priceCurrency,
      stock: schema.productVariants.stockOnHand,
    })
    .from(schema.productVariants)
    .where(and(eq(schema.productVariants.tenantId, tenantId), eq(schema.productVariants.pubId, variantPubId)))
    .limit(1);
  if (!v) return null;
  const [p] = await tx
    .select({ title: schema.products.title, description: schema.products.descriptionHtml })
    .from(schema.products)
    .where(eq(schema.products.id, v.productId))
    .limit(1);
  const media = await tx
    .select({ url: schema.productMedia.url })
    .from(schema.productMedia)
    .where(eq(schema.productMedia.productId, v.productId))
    .orderBy(schema.productMedia.position);
  return {
    variantId: v.id,
    input: {
      sku: v.sku,
      ean: v.barcode,
      title: p?.title ?? 'Product',
      descriptionHtml: p?.description ?? '',
      priceMinor: v.price,
      currency: v.currency,
      stock: v.stock,
      images: media.map((m) => m.url),
    },
  };
}

async function upsertListing(
  tx: TenantTx,
  args: {
    tenantId: string;
    channelId: string;
    variantId: string;
    externalOfferId?: string;
    status: 'draft' | 'active' | 'ended' | 'error';
    priceAmount?: bigint;
    stock?: number;
    lastError?: string;
    listedNow?: boolean;
  },
): Promise<void> {
  await tx
    .insert(schema.marketplaceListings)
    .values({
      tenantId: args.tenantId,
      channelId: args.channelId,
      variantId: args.variantId,
      externalOfferId: args.externalOfferId ?? null,
      status: args.status,
      lastPriceAmount: args.priceAmount ?? null,
      lastStock: args.stock ?? null,
      lastError: args.lastError ?? null,
      listedAt: args.listedNow ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [schema.marketplaceListings.channelId, schema.marketplaceListings.variantId],
      set: {
        ...(args.externalOfferId ? { externalOfferId: args.externalOfferId } : {}),
        status: args.status,
        ...(args.priceAmount !== undefined ? { lastPriceAmount: args.priceAmount } : {}),
        ...(args.stock !== undefined ? { lastStock: args.stock } : {}),
        lastError: args.lastError ?? null,
        ...(args.listedNow ? { listedAt: new Date() } : {}),
        updatedAt: new Date(),
      },
    });
}

function serializeChannel(c: typeof schema.marketplaceChannels.$inferSelect) {
  return {
    id: c.pubId,
    platform: c.platform,
    name: c.name,
    status: c.status,
    external_account_id: c.externalAccountId,
    last_sync_at: c.lastSyncAt,
    last_error: c.lastError,
    created_at: c.createdAt,
  };
}
function serializeListing(l: typeof schema.marketplaceListings.$inferSelect) {
  return {
    id: l.id,
    external_offer_id: l.externalOfferId,
    status: l.status,
    last_price_amount: l.lastPriceAmount?.toString() ?? null,
    last_stock: l.lastStock,
    last_error: l.lastError,
    listed_at: l.listedAt,
  };
}

function noTenant(reply: any) {
  return reply.code(400).send({ error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' } });
}
function notFound(reply: any, code: string) {
  return reply.code(404).send({ error: { code, message: 'Not found' } });
}
function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: { code: 'VALIDATION_FAILED', message: 'Invalid input', field_errors: error.flatten().fieldErrors },
  });
}
