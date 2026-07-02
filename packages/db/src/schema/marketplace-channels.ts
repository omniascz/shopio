/**
 * External marketplace channels (BaseLinker-style) — a tenant's OUTBOUND
 * connection to Allegro / Amazon / Kaufland etc., plus the per-variant listing
 * mapping. Distinct from `marketplace.ts` (that is the multi-vendor storefront).
 *
 * A `marketplace_channel` is one connected external account; a
 * `marketplace_listing` maps a Shopio variant to one external offer and caches
 * the last-pushed price/stock so sync is idempotent and diffable.
 *
 * Credentials note: OAuth tokens for a REAL platform must be stored via
 * `lib/secrets` (like payment configs), never in `settings` plaintext. `settings`
 * holds only non-secret config. The `mock` platform needs no credentials.
 */

import { sql } from 'drizzle-orm';
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { productVariants } from './product-variants';

export const MARKETPLACE_PLATFORMS = ['allegro', 'mock'] as const;
export const MARKETPLACE_CHANNEL_STATUSES = ['disconnected', 'connected', 'error'] as const;

export const marketplaceChannels = pgTable(
  'marketplace_channels',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // mch_ NanoID
    platform: text('platform', { enum: MARKETPLACE_PLATFORMS }).notNull(),
    name: text('name').notNull(),
    /** External seller/account id on the platform (once connected). */
    externalAccountId: text('external_account_id'),
    status: text('status', { enum: MARKETPLACE_CHANNEL_STATUSES }).notNull().default('disconnected'),
    /** Non-secret config only (see file header). */
    settings: jsonb('settings')
      .notNull()
      .default(sql`'{}'::jsonb`),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_marketplace_channels_pub_id').on(t.tenantId, t.pubId),
    tenantIdx: index('idx_marketplace_channels_tenant').on(t.tenantId, t.status),
  }),
);

export const MARKETPLACE_LISTING_STATUSES = ['draft', 'active', 'ended', 'error'] as const;

export const marketplaceListings = pgTable(
  'marketplace_listings',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => marketplaceChannels.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    /** Offer id on the external platform (null until first listed). */
    externalOfferId: text('external_offer_id'),
    status: text('status', { enum: MARKETPLACE_LISTING_STATUSES }).notNull().default('draft'),
    /** Last price/stock pushed to the platform — for idempotent diff-sync. */
    lastPriceAmount: bigint('last_price_amount', { mode: 'bigint' }),
    lastStock: integer('last_stock'),
    lastError: text('last_error'),
    listedAt: timestamp('listed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    listingUnique: uniqueIndex('uq_marketplace_listings_variant').on(t.channelId, t.variantId),
    channelIdx: index('idx_marketplace_listings_channel').on(t.channelId, t.status),
    offerIdx: index('idx_marketplace_listings_offer').on(t.tenantId, t.externalOfferId),
  }),
);

export type MarketplaceChannel = typeof marketplaceChannels.$inferSelect;
export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
