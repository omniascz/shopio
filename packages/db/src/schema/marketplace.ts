/**
 * Marketplace (multi-vendor) — per `25-marketplace.md` MVP (ENT-SELLER-001,
 * ENT-SELLER-PRODUCT-001).
 *
 * Amazon-style: third-party vendors list products under one tenant storefront;
 * the platform records a commission per sold line. This MVP is PAYMENT-
 * INDEPENDENT — it stores vendors, links products to a vendor, and records a
 * commission ledger at order placement (pure arithmetic, no money movement).
 *
 * Deferred (per `25`, payment-coupled): Stripe Connect onboarding, KYC, bank
 * accounts, payout scheduling/execution, split payments, reverse-transfer
 * refunds, facilitator tax. Deferred (scope): vendor self-service portal +
 * vendor-user auth, vendor storefronts, ratings, messaging, disputes, tiers.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { orders, orderItems } from './orders';

export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // ven_ NanoID
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    legalEntityName: text('legal_entity_name'),
    registrationNumber: text('registration_number'), // IČO
    vatId: text('vat_id'), // DIČ
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone'),
    status: text('status', { enum: ['pending', 'active', 'suspended', 'closed'] })
      .notNull()
      .default('pending'),
    /** Platform commission, basis points (1500 = 15.00 %). RULE-MKT-004: ≤ 10000. */
    commissionBasisPoints: integer('commission_basis_points').notNull().default(1500),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUnique: uniqueIndex('uq_vendors_slug').on(t.tenantId, t.slug),
    pubIdUnique: uniqueIndex('uq_vendors_pub_id').on(t.tenantId, t.pubId),
    tenantIdx: index('idx_vendors_tenant').on(t.tenantId, t.status),
  }),
);

/**
 * Commission ledger — one row per sold order line that belongs to a vendor,
 * written at order placement. Records the platform cut + vendor earning; no
 * balance/payout is touched (deferred).
 */
export const marketplaceCommissions = pgTable(
  'marketplace_commissions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    orderItemId: uuid('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    currency: text('currency').notNull(),
    /** Snapshot of the line net (ex-tax) the commission was computed on. */
    lineSubtotalAmount: bigint('line_subtotal_amount', { mode: 'bigint' }).notNull(),
    commissionBasisPoints: integer('commission_basis_points').notNull(),
    commissionAmount: bigint('commission_amount', { mode: 'bigint' }).notNull(),
    vendorEarningAmount: bigint('vendor_earning_amount', { mode: 'bigint' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    lineUnique: uniqueIndex('uq_mkt_commissions_line').on(t.orderItemId),
    vendorIdx: index('idx_mkt_commissions_vendor').on(t.tenantId, t.vendorId, t.createdAt),
    orderIdx: index('idx_mkt_commissions_order').on(t.orderId),
  }),
);

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type MarketplaceCommission = typeof marketplaceCommissions.$inferSelect;
