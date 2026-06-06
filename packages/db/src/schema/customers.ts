/**
 * `customers` + `customer_sessions` — per `18-customer-management.md`
 * (ENT-CUSTOMER-001), MVP subset.
 *
 * Customers are PER-TENANT identities (the same email can have separate
 * accounts in different shops — they are different businesses). Auth is
 * email+password for MVP; the schema leaves room for the passkey-first
 * upgrade (`password_hash` nullable, `auth_methods` jsonb).
 *
 * Sessions are opaque tokens (sha256 hash stored, raw value only in the
 * httpOnly cookie) — no JWT on the storefront, instant revocation.
 *
 * Deferred: passkeys/WebAuthn, email verification, addresses book, marketing
 * consents, customer groups/B2B.
 */

import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const customers = pgTable(
  'customers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // cus_ NanoID
    email: text('email').notNull(), // lowercased
    fullName: text('full_name'),
    phone: text('phone'),
    /** Nullable — passkey-only accounts come with the WebAuthn wave. */
    passwordHash: text('password_hash'),
    /** Set when the verify-link from the welcome e-mail is clicked. */
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    status: text('status', { enum: ['active', 'disabled'] })
      .notNull()
      .default('active'),
    /** Future: ['password','passkey'] etc. */
    authMethods: jsonb('auth_methods')
      .notNull()
      .default(sql`'["password"]'::jsonb`),
    /** Default shipping address snapshot — prefills checkout. */
    defaultAddress: jsonb('default_address'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_customers_pub_id').on(t.tenantId, t.pubId),
    emailUnique: uniqueIndex('uq_customers_email').on(t.tenantId, t.email),
  }),
);

export const customerSessions = pgTable(
  'customer_sessions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    /** sha256(raw cookie token) — raw value never stored. */
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    tokenUnique: uniqueIndex('uq_customer_sessions_token').on(t.tokenHash),
    customerIdx: index('idx_customer_sessions_customer').on(t.customerId),
    expiryIdx: index('idx_customer_sessions_expiry')
      .on(t.expiresAt)
      .where(sql`revoked_at IS NULL`),
  }),
);

/** One-time tokens for password reset / e-mail verification flows. */
export const customerAuthTokens = pgTable(
  'customer_auth_tokens',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    /** sha256(raw token) — raw value only ever appears in the e-mailed link. */
    tokenHash: text('token_hash').notNull(),
    purpose: text('purpose', { enum: ['password_reset', 'email_verify'] }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUnique: uniqueIndex('uq_customer_auth_tokens_token').on(t.tokenHash),
    customerIdx: index('idx_customer_auth_tokens_customer').on(t.customerId, t.purpose),
  }),
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerSession = typeof customerSessions.$inferSelect;
export type CustomerAuthToken = typeof customerAuthTokens.$inferSelect;
