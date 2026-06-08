/**
 * Subscriptions / recurring orders (per `24-subscriptions.md` MVP).
 *
 * A subscription regenerates an order on a fixed cadence (consumables, refills).
 * MVP scope: the scheduler creates a new pending order each cycle and e-mails
 * the customer — it does NOT auto-charge a saved card (MIT requires stored
 * payment methods, deferred). Offline methods (COD / bank transfer) flow
 * naturally; gateway methods send the customer a pay link per cycle.
 *
 * Deferred (per `24`): MIT auto-charge, saved payment methods, dunning, proration,
 * trials, plan changes, usage-based billing, pause windows.
 */

import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { customers } from './customers';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // sub_ NanoID
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['active', 'paused', 'cancelled'] })
      .notNull()
      .default('active'),
    /** Ordered items snapshot: [{ variant_id (uuid), quantity }]. */
    items: jsonb('items').notNull(),
    /** Shipping address snapshot reused for every generated order. */
    shippingAddress: jsonb('shipping_address').notNull(),
    /** Payment method code applied to each generated order. */
    paymentMethod: text('payment_method').notNull().default('cod'),
    intervalUnit: text('interval_unit', { enum: ['week', 'month'] }).notNull(),
    intervalCount: integer('interval_count').notNull().default(1),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    ordersCreated: integer('orders_created').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_subscriptions_pub_id').on(t.tenantId, t.pubId),
    customerIdx: index('idx_subscriptions_customer').on(t.tenantId, t.customerId),
    dueIdx: index('idx_subscriptions_due').on(t.status, t.nextRunAt),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
