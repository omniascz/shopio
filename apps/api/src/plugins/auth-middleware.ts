/**
 * Auth middleware — verifies Bearer JWT and attaches auth context to request.
 *
 * Per `30-security.md §5.6` (JWT claims) + `36-personas-rbac.md`.
 *
 * Usage on route:
 * ```
 * app.get('/protected', { preHandler: requireAuth }, handler);
 * app.get('/admin', { preHandler: requirePermission(PERMISSIONS.ADMIN_FULL) }, handler);
 * ```
 */

import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import {
  PermissionDeniedError,
  can,
  verifyAccessToken,
  type AuthContext,
  type PermissionCode,
  type ShopioJwtClaims,
} from '@shopio/authz';
import { getConfig } from '../config';
import { getDb } from '../db';
import { isApiKey, resolveApiKey } from '../lib/api-keys';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

// =============================================================================
// Tenant status guard (per `30-security.md` — suspended tenants must not write)
// =============================================================================

type TenantStatusChecker = (tenantId: string) => Promise<string | null>;

let _tenantStatusChecker: TenantStatusChecker | null = null;
const _statusCache = new Map<string, { status: string; expiresAt: number }>();
const STATUS_CACHE_TTL_MS = 30_000;

/** Wire the DB lookup at server boot (middleware has no direct db access). */
export function setTenantStatusChecker(fn: TenantStatusChecker): void {
  _tenantStatusChecker = fn;
  _statusCache.clear();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Block mutations for non-active tenants (suspended/closing/closed). Reads
 * stay allowed so the merchant can still see their data. Best-effort cache
 * (30 s) keeps this to ~zero overhead.
 */
async function assertTenantWritable(
  req: FastifyRequest,
  reply: FastifyReply,
  ctx: AuthContext,
): Promise<boolean> {
  if (!ctx.tenantId || !_tenantStatusChecker) return true;
  if (SAFE_METHODS.has(req.method)) return true;

  const now = Date.now();
  const cached = _statusCache.get(ctx.tenantId);
  let status = cached && cached.expiresAt > now ? cached.status : null;
  if (!status) {
    status = (await _tenantStatusChecker(ctx.tenantId)) ?? 'missing';
    _statusCache.set(ctx.tenantId, { status, expiresAt: now + STATUS_CACHE_TTL_MS });
  }

  if (status !== 'active' && status !== 'provisioning') {
    void reply.code(403).send({
      error: {
        code: 'TENANT_SUSPENDED',
        message: `Tenant is ${status} — write operations are disabled`,
      },
    });
    return false;
  }
  return true;
}

/**
 * Extract + verify JWT, attach to req.auth. 401 on failure.
 */
export const requireAuth: preHandlerHookHandler = async (req, reply) => {
  const ctx = await tryAuth(req);
  if (!ctx) {
    return reply.code(401).send({
      error: { code: 'AUTH_REQUIRED', message: 'Authorization required' },
    });
  }
  if (!(await assertTenantWritable(req, reply, ctx))) return reply;
  req.auth = ctx;
};

/**
 * Like requireAuth but does NOT reject on missing token. Useful for endpoints
 * that have different behavior for anonymous vs authenticated users.
 */
export const optionalAuth: preHandlerHookHandler = async (req) => {
  const ctx = await tryAuth(req);
  if (ctx) req.auth = ctx;
};

/**
 * Require specific permission. Builds on requireAuth.
 */
export function requirePermission(permission: PermissionCode): preHandlerHookHandler {
  return async (req, reply) => {
    const ctx = await tryAuth(req);
    if (!ctx) {
      return reply.code(401).send({
        error: { code: 'AUTH_REQUIRED', message: 'Authorization required' },
      });
    }
    if (!can(ctx, permission)) {
      return reply.code(403).send({
        error: {
          code: 'PERMISSION_DENIED',
          message: `Required permission: ${permission}`,
          required: permission,
        },
      });
    }
    if (!(await assertTenantWritable(req, reply, ctx))) return reply;
    req.auth = ctx;
  };
}

/**
 * Try to extract auth context. Returns null if no/invalid token.
 */
async function tryAuth(req: FastifyRequest): Promise<AuthContext | null> {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : typeof apiKeyHeader === 'string'
      ? apiKeyHeader
      : null;
  if (!token) return null;

  const config = getConfig();

  // API key path (per `28`): programmatic access. The key determines the tenant
  // (looked up on the superuser pool — precedes RLS context), and reuses the
  // existing admin permissions[] so per-endpoint permission checks work as-is.
  if (isApiKey(token)) {
    const key = await resolveApiKey(getDb(config), token);
    if (!key) return null;
    return {
      userId: key.createdByUserId ?? key.id,
      tenantId: key.tenantId,
      permissions: key.permissions as AuthContext['permissions'],
      assuranceLevel: 'mfa_verified',
      sessionId: `apikey:${key.id}`,
    };
  }

  let claims: ShopioJwtClaims;
  try {
    claims = await verifyAccessToken(token, config.SHOPIO_JWT_SECRET);
  } catch {
    return null;
  }

  return {
    userId: claims.sub,
    tenantId: claims.tnt || '',
    permissions: claims.permissions,
    assuranceLevel: claims.assurance_level,
    sessionId: claims.session_id,
  };
}

/** Helper to throw uniform error from handler when ABAC policy fails. */
export function denyWith(reply: FastifyReply, err: PermissionDeniedError): FastifyReply {
  return reply.code(403).send({
    error: {
      code: 'PERMISSION_DENIED',
      message: err.message,
      required: err.required,
    },
  });
}
