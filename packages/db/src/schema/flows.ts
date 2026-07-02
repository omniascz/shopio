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

/** Lifecycle of a single flow execution (one row per flow × triggering order). */
export const FLOW_RUN_STATUSES = ['succeeded', 'pending_retry', 'failed'] as const;

/**
 * `flow_runs` — durable, observable audit of every flow execution, plus the
 * retry queue for actions that reach the outside world (webhook, e-mail).
 * A `pending_retry` row is re-attempted by the retry worker after
 * `next_attempt_at`; terminal at `max_attempts` (→ `failed`). This is the
 * reliability layer base.com's "Automatic Actions" lack — merchants can see
 * exactly what ran, what failed, and why.
 */
export const flowRuns = pgTable(
  'flow_runs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    flowId: uuid('flow_id')
      .notNull()
      .references(() => flows.id, { onDelete: 'cascade' }),
    flowPubId: text('flow_pub_id').notNull(),
    triggerEvent: text('trigger_event', { enum: FLOW_TRIGGERS }).notNull(),
    orderId: uuid('order_id'),
    orderNumber: text('order_number'),
    status: text('status', { enum: FLOW_RUN_STATUSES }).notNull(),
    attempts: integer('attempts').notNull().default(1),
    maxAttempts: integer('max_attempts').notNull().default(5),
    /** Per-action outcomes: [{ type, status, detail? }] in execution order. */
    actionResults: jsonb('action_results')
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Frozen actions still awaiting a successful retry. */
    pendingActions: jsonb('pending_actions')
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Frozen condition context so a retry runs against the original order state. */
    contextSnapshot: jsonb('context_snapshot')
      .notNull()
      .default(sql`'{}'::jsonb`),
    error: text('error'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    flowIdx: index('idx_flow_runs_flow').on(t.tenantId, t.flowId, t.createdAt),
    dueIdx: index('idx_flow_runs_due').on(t.status, t.nextAttemptAt),
  }),
);

export type FlowRun = typeof flowRuns.$inferSelect;
export type NewFlowRun = typeof flowRuns.$inferInsert;
