/**
 * `channels` — sales channel registry per `22-multistore-channels.md` MVP
 * (ENT-CHANNEL-001).
 *
 * A channel is where an order originates: the web storefront, a manual/phone
 * order entered by staff, POS, etc. Orders reference a channel so revenue can
 * be sliced by channel and so non-web sales (phone/email) become first-class.
 *
 * MVP keeps it lean: code/kind/name/active. Per-channel pricing, payment &
 * shipping overrides, catalog filtering, and the whole multi-STORE layer
 * (separate domains/themes/POS terminals/marketplace feeds) are deferred.
 */

import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const channels = pgTable(
  'channels',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // chn_ NanoID
    /** Stable per-tenant identifier — 'web', 'manual', 'pos', ... */
    code: text('code').notNull(),
    /** Channel family for reporting/grouping. */
    kind: text('kind', {
      enum: ['storefront_web', 'manual', 'pos', 'marketplace', 'mobile_app', 'b2b_portal'],
    }).notNull(),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeUnique: uniqueIndex('uq_channels_code').on(t.tenantId, t.code),
    pubIdUnique: uniqueIndex('uq_channels_pub_id').on(t.tenantId, t.pubId),
    tenantIdx: index('idx_channels_tenant').on(t.tenantId),
  }),
);

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
