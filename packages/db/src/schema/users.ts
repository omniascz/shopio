/**
 * `users` — staff/admin users (per `18-customer-management.md`, `30-security.md §4`).
 *
 * Note: Customer accounts are separate entity (`customers` table — Fáze 1).
 * `users` here = admin/staff users that operate the platform.
 */

import { sql } from 'drizzle-orm';
import { customType, pgTable, text, timestamp, uuid, jsonb, inet, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    pubId: text('pub_id').notNull(),                                                                    // usr_ NanoID
    email: citext('email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    fullName: text('full_name'),
    // Auth (per `30 §4`)
    passwordHash: text('password_hash'),                                                                  // argon2id; NULL if passkey-only
    mfaEnrolledAt: timestamp('mfa_enrolled_at', { withTimezone: true }),
    mfaTotpSecretEncrypted: text('mfa_totp_secret_encrypted'),                                              // envelope-encrypted
    // Status
    status: text('status', { enum: ['active', 'suspended', 'pending_verification', 'closed'] })
      .notNull()
      .default('pending_verification'),
    suspensionReason: text('suspension_reason'),
    // Locale + preferences
    locale: text('locale').notNull().default('cs-CZ'),
    timezone: text('timezone').notNull().default('Europe/Prague'),
    // Lockout (per `30 §4.7.3`, `RULE-SEC-048`)
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    // Activity
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: inet('last_login_ip'),
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_users_pub_id').on(t.pubId),
    emailUnique: uniqueIndex('uq_users_email').on(t.email),
    activeIdx: index('idx_users_active').on(t.status).where(sql`status = 'active'`),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * `user_tenant_memberships` — per `36-personas-rbac.md §12.4`.
 * Many-to-many users ↔ tenants with persona/custom role.
 */
export const userTenantMemberships = pgTable(
  'user_tenant_memberships',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    personaCode: text('persona_code'),                                                                    // 'MERCHANT-OWNER', etc.
    customRoleId: uuid('custom_role_id'),                                                                  // Fáze 2 custom roles
    scopeStoreIds: text('scope_store_ids').array(),                                                         // ABAC scope
    scopeRegionCodes: text('scope_region_codes').array(),
    status: text('status', { enum: ['active', 'suspended', 'revoked', 'pending_acceptance'] })
      .notNull()
      .default('pending_acceptance'),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    assignedByUserId: uuid('assigned_by_user_id'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    uniquePerTenant: uniqueIndex('uq_user_tenant_memberships').on(t.tenantId, t.userId),
    activeUserIdx: index('idx_user_tenant_memberships_user').on(t.userId).where(sql`status = 'active'`),
    activeTenantIdx: index('idx_user_tenant_memberships_tenant').on(t.tenantId).where(sql`status = 'active'`),
  }),
);

export type UserTenantMembership = typeof userTenantMemberships.$inferSelect;
export type NewUserTenantMembership = typeof userTenantMemberships.$inferInsert;
