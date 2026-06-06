/**
 * Developer platform — API keys + outbound webhooks (per `28-developer-platform.md`
 * MVP). Payment-independent.
 *
 * API keys: tenant-scoped programmatic access; the plaintext key is shown once,
 * only its hash is stored. They reuse the existing admin `permissions[]` — no
 * parallel scope catalog.
 *
 * Outbound webhooks: tenants register endpoints + subscribed topics; domain
 * events fan out as signed (HMAC-SHA256) POSTs. Delivery rows are the durable
 * log + retry cursor (lean, no job queue — inline send + retry-on-next-event).
 *
 * Deferred (per `28`): OAuth apps, app marketplace, edge functions, MCP,
 * GraphQL, SDK gen, rate-limit tiers, IP allowlists, webhook filtering/replay
 * UI, full async worker/DLQ, signing-key rotation.
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

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // akey_ NanoID
    name: text('name').notNull(),
    keyPrefix: text('key_prefix').notNull(), // 'sk_live_'
    keyHint: text('key_hint').notNull(), // last 4 chars for UX
    keyHash: text('key_hash').notNull(), // sha256(full key), never plaintext
    permissions: text('permissions').array().notNull(),
    status: text('status', { enum: ['active', 'revoked'] })
      .notNull()
      .default('active'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    hashUnique: uniqueIndex('uq_api_keys_hash').on(t.keyHash),
    pubIdUnique: uniqueIndex('uq_api_keys_pub_id').on(t.tenantId, t.pubId),
    tenantIdx: index('idx_api_keys_tenant').on(t.tenantId, t.status),
  }),
);

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // whe_ NanoID
    url: text('url').notNull(),
    secretHash: text('secret_hash').notNull(), // HMAC signing secret (shown once)
    secretHint: text('secret_hint').notNull(),
    topics: text('topics').array().notNull(), // ['order.placed', ...]
    enabled: boolean('enabled').notNull().default(true),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    paused: boolean('paused').notNull().default(false),
    createdByUserId: uuid('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_webhook_endpoints_pub_id').on(t.tenantId, t.pubId),
    tenantIdx: index('idx_webhook_endpoints_tenant').on(t.tenantId),
  }),
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // whd_ NanoID
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    eventId: text('event_id').notNull(), // idempotency key for the consumer
    payload: jsonb('payload').notNull(),
    status: text('status', { enum: ['pending', 'delivered', 'failed', 'abandoned'] })
      .notNull()
      .default('pending'),
    attempts: integer('attempts').notNull().default(0),
    responseCode: integer('response_code'),
    lastError: text('last_error'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_webhook_deliveries_pub_id').on(t.tenantId, t.pubId),
    dueIdx: index('idx_webhook_deliveries_due').on(t.status, t.nextAttemptAt),
    endpointIdx: index('idx_webhook_deliveries_endpoint').on(t.endpointId, t.createdAt),
  }),
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
