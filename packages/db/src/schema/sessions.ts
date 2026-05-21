/**
 * `sessions` — per `30-security.md §4.6.2`.
 * Refresh-token-backed session with rotation chain.
 */

import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, jsonb, inet, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id'),                                                                                  // NULL for customer sessions
    familyId: uuid('family_id').notNull(),                                                                            // rotation chain
    refreshTokenHash: text('refresh_token_hash').notNull(),                                                            // argon2id hash
    deviceFingerprintHash: text('device_fingerprint_hash'),
    userAgent: text('user_agent'),
    ipAddress: inet('ip_address'),
    countryCode: text('country_code'),                                                                                  // GeoIP
    city: text('city'),
    assuranceLevel: text('assurance_level', { enum: ['low', 'mfa_verified', 'step_up'] }).notNull(),
    mfaVerifiedAt: timestamp('mfa_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    refreshHashUnique: uniqueIndex('uq_sessions_refresh_hash').on(t.refreshTokenHash),
    activeUserIdx: index('idx_sessions_user_active').on(t.userId).where(sql`revoked_at IS NULL`),
    expiryIdx: index('idx_sessions_expiry').on(t.expiresAt).where(sql`revoked_at IS NULL`),
    familyIdx: index('idx_sessions_family').on(t.familyId),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
