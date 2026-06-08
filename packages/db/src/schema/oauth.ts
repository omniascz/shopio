/**
 * OAuth 2.0 apps + app marketplace (per `28-developer-platform.md`).
 *
 * Three concerns:
 *  - `oauth_apps` — a GLOBAL registry of third-party apps (registered once by a
 *    developer; not tenant-scoped, like `tenants`). Holds the client_id, the
 *    hashed client_secret, allowed redirect URIs and the scopes the app may
 *    request.
 *  - `oauth_authorizations` — a per-tenant INSTALL: the record that a merchant
 *    granted an app a set of scopes. This is the marketplace "installed app".
 *  - `oauth_auth_codes` + `oauth_tokens` — the Authorization-Code flow's
 *    short-lived code and the issued access/refresh tokens. Looked up by hash
 *    on the superuser pool in the auth path (the token determines the tenant),
 *    mirroring API keys.
 *
 * Tokens/secrets are shown once; only their sha256 hash is persisted.
 */

import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

/** Global app registry — NOT tenant-scoped (no RLS; like `tenants`). */
export const oauthApps = pgTable(
  'oauth_apps',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    pubId: text('pub_id').notNull(), // oac_ NanoID
    name: text('name').notNull(),
    description: text('description'),
    clientId: text('client_id').notNull(), // shpca_…
    clientSecretHash: text('client_secret_hash').notNull(), // sha256(shpcs_…)
    clientSecretHint: text('client_secret_hint').notNull(),
    redirectUris: text('redirect_uris').array().notNull(),
    /** Scopes the app is permitted to request (subset granted at consent). */
    scopes: text('scopes').array().notNull(),
    iconUrl: text('icon_url'),
    websiteUrl: text('website_url'),
    status: text('status', { enum: ['active', 'suspended'] })
      .notNull()
      .default('active'),
    /** The developer (platform/admin user) who registered the app. */
    ownerUserId: uuid('owner_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_oauth_apps_pub_id').on(t.pubId),
    clientIdUnique: uniqueIndex('uq_oauth_apps_client_id').on(t.clientId),
    statusIdx: index('idx_oauth_apps_status').on(t.status),
  }),
);

/** Per-tenant install / consent record. RLS tenant-isolated. */
export const oauthAuthorizations = pgTable(
  'oauth_authorizations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pubId: text('pub_id').notNull(), // oai_ NanoID
    appId: uuid('app_id')
      .notNull()
      .references(() => oauthApps.id, { onDelete: 'cascade' }),
    scopes: text('scopes').array().notNull(), // granted scopes
    status: text('status', { enum: ['active', 'revoked'] })
      .notNull()
      .default('active'),
    createdByUserId: uuid('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    pubIdUnique: uniqueIndex('uq_oauth_authorizations_pub_id').on(t.tenantId, t.pubId),
    // One active authorization per (tenant, app) — re-consent updates it.
    appUnique: uniqueIndex('uq_oauth_authorizations_app')
      .on(t.tenantId, t.appId)
      .where(sql`status = 'active'`),
    tenantIdx: index('idx_oauth_authorizations_tenant').on(t.tenantId, t.status),
  }),
);

/** Short-lived authorization codes (PKCE-ready). Looked up by hash. */
export const oauthAuthCodes = pgTable(
  'oauth_auth_codes',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    appId: uuid('app_id')
      .notNull()
      .references(() => oauthApps.id, { onDelete: 'cascade' }),
    authorizationId: uuid('authorization_id')
      .notNull()
      .references(() => oauthAuthorizations.id, { onDelete: 'cascade' }),
    scopes: text('scopes').array().notNull(),
    redirectUri: text('redirect_uri').notNull(),
    codeChallenge: text('code_challenge'), // PKCE S256, optional
    userId: uuid('user_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeUnique: uniqueIndex('uq_oauth_auth_codes_code').on(t.codeHash),
  }),
);

/** Issued access + refresh tokens. Access token looked up by hash in auth path. */
export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    appId: uuid('app_id')
      .notNull()
      .references(() => oauthApps.id, { onDelete: 'cascade' }),
    authorizationId: uuid('authorization_id')
      .notNull()
      .references(() => oauthAuthorizations.id, { onDelete: 'cascade' }),
    accessTokenHash: text('access_token_hash').notNull(),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    scopes: text('scopes').array().notNull(),
    accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp('refresh_expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accessUnique: uniqueIndex('uq_oauth_tokens_access').on(t.accessTokenHash),
    refreshUnique: uniqueIndex('uq_oauth_tokens_refresh').on(t.refreshTokenHash),
    authIdx: index('idx_oauth_tokens_authorization').on(t.authorizationId),
  }),
);

export type OAuthApp = typeof oauthApps.$inferSelect;
export type OAuthAuthorization = typeof oauthAuthorizations.$inferSelect;
export type OAuthAuthCode = typeof oauthAuthCodes.$inferSelect;
export type OAuthToken = typeof oauthTokens.$inferSelect;
