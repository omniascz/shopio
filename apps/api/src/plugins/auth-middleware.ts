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

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
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
    req.auth = ctx;
  };
}

/**
 * Try to extract auth context. Returns null if no/invalid token.
 */
async function tryAuth(req: FastifyRequest): Promise<AuthContext | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);

  const config = getConfig();
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
