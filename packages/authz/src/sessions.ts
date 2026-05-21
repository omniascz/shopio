/**
 * Session management helpers.
 *
 * Per `30-security.md §4.6.2`. Refresh token rotation per `28 §4.5`:
 * - Each refresh issues new pair, marks old as consumed (family chain)
 * - Reuse of consumed refresh → entire family revoked
 */

import { randomUUID } from 'node:crypto';

/** TTLs per `30 §4.6.1` */
export const REFRESH_TOKEN_TTL_MS = {
  admin: 14 * 24 * 60 * 60 * 1000, // 14 days
  customer: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const;

export const IDLE_TIMEOUT_MS = {
  admin: 60 * 60 * 1000, // 60 min
  customer: 90 * 60 * 1000, // 90 min
} as const;

export type SessionScope = 'admin' | 'customer';

export interface NewSessionData {
  userId: string;
  tenantId: string | null;
  scope: SessionScope;
  familyId: string;
  refreshTokenHash: string;
  userAgent: string | undefined;
  ipAddress: string | undefined;
  countryCode: string | undefined;
  assuranceLevel: 'low' | 'mfa_verified' | 'step_up';
  mfaVerifiedAt: Date | undefined;
  expiresAt: Date;
}

/**
 * Build session record data for INSERT.
 * `familyId` should be reused across rotations.
 */
export function buildSessionRecord(input: {
  userId: string;
  tenantId: string | null;
  scope: SessionScope;
  refreshTokenHash: string;
  familyId?: string | undefined;
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
  countryCode?: string | undefined;
  assuranceLevel?: 'low' | 'mfa_verified' | 'step_up' | undefined;
  mfaVerifiedAt?: Date | undefined;
}): NewSessionData {
  const familyId = input.familyId ?? randomUUID();
  const ttl = REFRESH_TOKEN_TTL_MS[input.scope];
  const expiresAt = new Date(Date.now() + ttl);

  return {
    userId: input.userId,
    tenantId: input.tenantId,
    scope: input.scope,
    familyId,
    refreshTokenHash: input.refreshTokenHash,
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
    countryCode: input.countryCode,
    assuranceLevel: input.assuranceLevel ?? 'low',
    mfaVerifiedAt: input.mfaVerifiedAt,
    expiresAt,
  };
}

/** Idle timeout check — is session still active? */
export function isSessionIdleExpired(
  lastUsedAt: Date,
  scope: SessionScope,
  now: Date = new Date(),
): boolean {
  return now.getTime() - lastUsedAt.getTime() > IDLE_TIMEOUT_MS[scope];
}

/** Cookie attributes for refresh token. Per `30 §4.6.1`. */
export function refreshCookieOptions(scope: SessionScope, isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_MS[scope] / 1000, // seconds
  };
}

export const REFRESH_COOKIE_NAME = 'shopio_refresh';
