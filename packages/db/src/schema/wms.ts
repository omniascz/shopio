/**
 * WMS foundation (per `09-inventory.md` "Deferred: warehouses/MSI, inventory
 * counts") — modelled on BaseLinker WMS. Additive layer over the existing
 * single-warehouse stock (`product_variants.stock_on_hand`): merchants can
 * define warehouses + storage bins and run stocktakes ("Inventury") that
 * reconcile physical vs system stock and write `adjustment` movements into the
 * existing append-only ledger.
 *
 * NOT in this layer (deferred, needs the checkout-reservation refactor):
 * per-warehouse stock split (true MSI) — sell-side availability still reads the
 * aggregate `stock_on_hand`.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { productVariants } from './product-variants';

export const warehouses = pgTable(
  'warehouses',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // wh_ NanoID
    code: text('code').notNull(), // short handle, e.g. 'MAIN'
    name: text('name').notNull(),
    address: jsonb('address')
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** Exactly one default per tenant (enforced app-side). */
    isDefault: boolean('is_default').notNull().default(false),
    /** Fulfilment preference order (lower = preferred). */
    priority: integer('priority').notNull().default(0),
    status: text('status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_warehouses_pub_id').on(t.tenantId, t.pubId),
    codeUnique: uniqueIndex('uq_warehouses_code').on(t.tenantId, t.code),
    tenantStatusIdx: index('idx_warehouses_tenant_status').on(t.tenantId, t.status),
  }),
);

export const STORAGE_BIN_TYPES = ['shelf', 'pallet', 'floor', 'bin', 'other'] as const;

export const storageBins = pgTable(
  'storage_bins',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    /** Position code, e.g. 'A-01-03'. */
    code: text('code').notNull(),
    binType: text('bin_type', { enum: STORAGE_BIN_TYPES }).notNull().default('shelf'),
    maxCapacity: integer('max_capacity'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeUnique: uniqueIndex('uq_storage_bins_code').on(t.tenantId, t.warehouseId, t.code),
    warehouseIdx: index('idx_storage_bins_warehouse').on(t.warehouseId),
  }),
);

export const STOCKTAKE_STATUSES = ['open', 'applied', 'cancelled'] as const;

export const stocktakes = pgTable(
  'stocktakes',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // stk_ NanoID
    warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    status: text('status', { enum: STOCKTAKE_STATUSES }).notNull().default('open'),
    note: text('note'),
    createdBy: uuid('created_by'),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_stocktakes_pub_id').on(t.tenantId, t.pubId),
    tenantStatusIdx: index('idx_stocktakes_tenant_status').on(t.tenantId, t.status),
  }),
);

export const stocktakeItems = pgTable(
  'stocktake_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    stocktakeId: uuid('stocktake_id')
      .notNull()
      .references(() => stocktakes.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    /** stock_on_hand snapshot when the line was counted. */
    systemQty: integer('system_qty').notNull(),
    countedQty: integer('counted_qty').notNull(),
    /** counted − system, cached for reporting. */
    variance: integer('variance').notNull(),
    applied: boolean('applied').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    itemUnique: uniqueIndex('uq_stocktake_items_variant').on(t.stocktakeId, t.variantId),
    stocktakeIdx: index('idx_stocktake_items_stocktake').on(t.stocktakeId),
  }),
);

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
export type StorageBin = typeof storageBins.$inferSelect;
export type Stocktake = typeof stocktakes.$inferSelect;
export type StocktakeItem = typeof stocktakeItems.$inferSelect;
