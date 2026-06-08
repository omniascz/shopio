/**
 * OAuth 2.0 helpers (per `28-developer-platform.md`).
 *
 * Authorization-Code flow primitives: credential/token generation, hashing,
 * the scope catalog and its mapping to the admin permission codes the
 * middleware already checks, plus access-token resolution on the superuser pool
 * (the token determines the tenant, so it precedes RLS — same as API keys).
 */

import { createHash, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { schema } from '@shopio/db';
import { PERMISSIONS } from '@shopio/authz';
import type { PermissionCode } from '@shopio/authz';
import type { AppDb } from '../db';

export const ACCESS_TOKEN_PREFIX = 'shpat_';
export const REFRESH_TOKEN_PREFIX = 'shprt_';
export const CLIENT_ID_PREFIX = 'shpca_';
export const CLIENT_SECRET_PREFIX = 'shpcs_';

export const ACCESS_TOKEN_TTL_SEC = 60 * 60 * 2; // 2h
export const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 60; // 60d
export const AUTH_CODE_TTL_SEC = 60 * 5; // 5m

/**
 * Scope catalog → admin permissions. A granted scope expands to the permission
 * codes its token carries in the AuthContext, so per-endpoint `requirePermission`
 * checks work unchanged. `full` maps to ADMIN_FULL (the catch-all most admin
 * endpoints require); granular scopes grant their specific permissions.
 */
export const SCOPE_CATALOG: Record<string, { label: string; permissions: PermissionCode[] }> = {
  'catalog:read': { label: 'Číst katalog (produkty)', permissions: [PERMISSIONS.PRODUCT_VIEW] },
  'catalog:write': {
    label: 'Spravovat katalog (produkty)',
    permissions: [
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_EDIT,
      PERMISSIONS.PRODUCT_PUBLISH,
    ],
  },
  'orders:read': { label: 'Číst objednávky', permissions: [PERMISSIONS.ORDER_VIEW] },
  'orders:write': {
    label: 'Spravovat objednávky',
    permissions: [PERMISSIONS.ORDER_VIEW, PERMISSIONS.ORDER_EDIT, PERMISSIONS.ORDER_FULFILL],
  },
  'customers:read': { label: 'Číst zákazníky', permissions: [PERMISSIONS.CUSTOMER_VIEW] },
  full: { label: 'Plný přístup k administraci', permissions: [PERMISSIONS.ADMIN_FULL] },
};

export const ALL_SCOPES = Object.keys(SCOPE_CATALOG);

export function isValidScope(scope: string): boolean {
  return scope in SCOPE_CATALOG;
}

/** Expand a granted scope list into the de-duplicated permission codes. */
export function scopesToPermissions(scopes: string[]): PermissionCode[] {
  const set = new Set<PermissionCode>();
  for (const s of scopes) {
    const entry = SCOPE_CATALOG[s];
    if (entry) for (const p of entry.permissions) set.add(p);
  }
  return [...set];
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function isOAuthAccessToken(token: string): boolean {
  return token.startsWith(ACCESS_TOKEN_PREFIX);
}

function gen(prefix: string, bytes = 24): { raw: string; hash: string; hint: string } {
  const raw = `${prefix}${randomBytes(bytes).toString('base64url')}`;
  return { raw, hash: hashToken(raw), hint: raw.slice(-4) };
}

export const generateClientId = () => `${CLIENT_ID_PREFIX}${randomBytes(12).toString('hex')}`;
export const generateClientSecret = () => gen(CLIENT_SECRET_PREFIX);
export const generateAccessToken = () => gen(ACCESS_TOKEN_PREFIX);
export const generateRefreshToken = () => gen(REFRESH_TOKEN_PREFIX);
export const generateAuthCode = () => gen('shpcode_', 32);

export interface ResolvedOAuthToken {
  tokenId: string;
  tenantId: string;
  appId: string;
  authorizationId: string;
  scopes: string[];
  permissions: PermissionCode[];
}

/**
 * Resolve a `shpat_…` access token (superuser pool) to its tenant + permissions.
 * Returns null when unknown, revoked, expired, or the install/app is inactive.
 */
export async function resolveAccessToken(
  db: AppDb,
  raw: string,
): Promise<ResolvedOAuthToken | null> {
  if (!isOAuthAccessToken(raw)) return null;
  const [row] = await db
    .select({
      token: schema.oauthTokens,
      authStatus: schema.oauthAuthorizations.status,
      appStatus: schema.oauthApps.status,
    })
    .from(schema.oauthTokens)
    .innerJoin(
      schema.oauthAuthorizations,
      eq(schema.oauthAuthorizations.id, schema.oauthTokens.authorizationId),
    )
    .innerJoin(schema.oauthApps, eq(schema.oauthApps.id, schema.oauthTokens.appId))
    .where(eq(schema.oauthTokens.accessTokenHash, hashToken(raw)))
    .limit(1);
  if (!row) return null;
  const t = row.token;
  if (t.revokedAt) return null;
  if (t.accessExpiresAt.getTime() <= Date.now()) return null;
  if (row.authStatus !== 'active' || row.appStatus !== 'active') return null;

  void db
    .update(schema.oauthTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.oauthTokens.id, t.id))
    .catch(() => {});

  return {
    tokenId: t.id,
    tenantId: t.tenantId,
    appId: t.appId,
    authorizationId: t.authorizationId,
    scopes: t.scopes,
    permissions: scopesToPermissions(t.scopes),
  };
}

/** Resolve a client_id + plaintext secret to the active app (superuser pool). */
export async function resolveClient(
  db: AppDb,
  clientId: string,
  clientSecret: string,
): Promise<typeof schema.oauthApps.$inferSelect | null> {
  const [app] = await db
    .select()
    .from(schema.oauthApps)
    .where(and(eq(schema.oauthApps.clientId, clientId), eq(schema.oauthApps.status, 'active')))
    .limit(1);
  if (!app) return null;
  if (app.clientSecretHash !== hashToken(clientSecret)) return null;
  return app;
}

export function serializeApp(a: typeof schema.oauthApps.$inferSelect, includeSecretHint = false) {
  return {
    id: a.pubId,
    name: a.name,
    description: a.description,
    client_id: a.clientId,
    ...(includeSecretHint ? { client_secret_hint: a.clientSecretHint } : {}),
    redirect_uris: a.redirectUris,
    scopes: a.scopes,
    icon_url: a.iconUrl,
    website_url: a.websiteUrl,
    status: a.status,
    created_at: a.createdAt,
  };
}
