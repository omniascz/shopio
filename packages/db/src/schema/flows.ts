/**
 * `flows` — no-code business automation (P3), modelled on BaseLinker's
 * "Automatic Actions" and Shopware's Flow Builder. A flow is:
 *   trigger event → conditions (all must hold) → actions
 *
 * e.g. "order.paid AND total ≥ 5000 → tag VIP" or "order.placed AND
 * payment_method = cod → email the warehouse". Evaluated synchronously when the
 * domain event fires (the same points that emit outbound webhooks).
 *
 * conditions: [{ field, op, value }]  (lib/flows defines the fields + ops)
 * actions:    [{ type, ...config }]
 */

import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

/** Domain events a flow can trigger on. */
export const FLOW_TRIGGERS = [
  'order.placed',
  'order.paid',
  'order.fulfilled',
  'order.cancelled',
] as const;

export const flows = pgTable(
  'flows',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // flw_ NanoID
    name: text('name').notNull(),
    triggerEvent: text('trigger_event', { enum: FLOW_TRIGGERS }).notNull(),
    /** [{ field, op, value }] — all must match (AND). Empty = always. */
    conditions: jsonb('conditions')
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** [{ type, ...config }] — executed in order. */
    actions: jsonb('actions')
      .notNull()
      .default(sql`'[]'::jsonb`),
    priority: integer('priority').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    /** Diagnostics: last run + run count. */
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    runCount: integer('run_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_flows_pub_id').on(t.tenantId, t.pubId),
    triggerIdx: index('idx_flows_trigger').on(t.tenantId, t.triggerEvent, t.isActive),
  }),
);

export type Flow = typeof flows.$inferSelect;
export type NewFlow = typeof flows.$inferInsert;
