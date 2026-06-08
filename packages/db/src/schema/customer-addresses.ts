/**
 * `customer_addresses` — saved address book (per `18-customer-management.md`).
 *
 * Powers express / returning-customer checkout: a logged-in customer keeps
 * several named addresses and picks one with a tap instead of retyping. The
 * single `customers.default_address` snapshot stays as the prefill fallback;
 * this table is the multi-address source, with one row flagged `is_default`.
 */

import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { customers } from './customers';

export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // adr_ NanoID
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    /** Customer-chosen label e.g. "Domů", "Práce". */
    label: text('label'),
    recipientName: text('recipient_name').notNull(),
    phone: text('phone'),
    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city').notNull(),
    postalCode: text('postal_code').notNull(),
    countryCode: text('country_code').notNull(), // ISO 3166-1 alpha-2
    state: text('state'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_customer_addresses_pub_id').on(t.tenantId, t.pubId),
    customerIdx: index('idx_customer_addresses_customer').on(t.tenantId, t.customerId),
    // At most one default per customer.
    oneDefault: uniqueIndex('uq_customer_addresses_default')
      .on(t.customerId)
      .where(sql`is_default`),
  }),
);

export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type NewCustomerAddress = typeof customerAddresses.$inferInsert;
