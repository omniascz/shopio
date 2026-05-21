/**
 * `audit_log_entries` — per `30-security.md §6.1`.
 * Append-only, hash-chained, immutable audit log.
 *
 * Partitioned by `occurred_at` (monthly) — Drizzle partition declared in raw SQL migration.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  inet,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const auditLogEntries = pgTable(
  'audit_log_entries',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id'), // NULL for platform-level
    pubId: text('pub_id').notNull(), // aud_ NanoID
    sequenceNumber: bigint('sequence_number', { mode: 'bigint' }).notNull(), // per tenant
    // Action
    category: text('category', {
      enum: [
        'auth',
        'authz',
        'data_access',
        'data_modification',
        'config_change',
        'security_event',
        'admin_action',
        'platform_action',
        'billing',
        'privacy',
        'impersonation',
        'plugin',
        'agent',
      ],
    }).notNull(),
    action: text('action').notNull(), // 'user.login', 'product.delete', ...
    outcome: text('outcome', { enum: ['success', 'failure', 'denied', 'pending'] }).notNull(),
    // Subject (who)
    actorKind: text('actor_kind', {
      enum: [
        'user',
        'service_account',
        'api_token',
        'app_installation',
        'platform_staff',
        'system',
        'agent',
      ],
    }).notNull(),
    actorUserId: uuid('actor_user_id'),
    actorTokenId: uuid('actor_token_id'),
    actorAppInstallationId: uuid('actor_app_installation_id'),
    actorLabel: text('actor_label'),
    // Target (what)
    resourceKind: text('resource_kind'),
    resourceId: uuid('resource_id'),
    resourceLabel: text('resource_label'),
    // Context
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    sessionId: uuid('session_id'),
    requestId: text('request_id'),
    // Detail
    reason: text('reason'),
    details: jsonb('details'),
    // Tamper-evidence (per `30 §8.3`)
    prevEntryHash: text('prev_entry_hash'),
    entryHash: text('entry_hash').notNull(),
    signedBatchId: uuid('signed_batch_id'),
    // Timing
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_audit_log_pub_id').on(t.pubId),
    sequenceUnique: uniqueIndex('uq_audit_log_sequence').on(t.tenantId, t.sequenceNumber),
    tenantIdx: index('idx_audit_log_tenant').on(t.tenantId, t.occurredAt),
    actorIdx: index('idx_audit_log_actor')
      .on(t.actorUserId, t.occurredAt)
      .where(sql`actor_user_id IS NOT NULL`),
    resourceIdx: index('idx_audit_log_resource')
      .on(t.resourceKind, t.resourceId, t.occurredAt)
      .where(sql`resource_id IS NOT NULL`),
    categoryIdx: index('idx_audit_log_category').on(t.tenantId, t.category, t.occurredAt),
    failuresIdx: index('idx_audit_log_outcome_failure')
      .on(t.tenantId, t.occurredAt)
      .where(sql`outcome IN ('failure','denied')`),
  }),
);

export type AuditLogEntry = typeof auditLogEntries.$inferSelect;
export type NewAuditLogEntry = typeof auditLogEntries.$inferInsert;
