/**
 * JWT access tokens + refresh token utilities.
 *
 * Per `30-security.md §4.6` + `28 §4.2`:
 * - Access token: short-lived JWT (15min), HS256 with rotating signing key
 * - Refresh token: random opaque token, stored as argon2id hash in `sessions` table
 * - Token format: `sho_at_<base64url>` for access, `sho_rt_<base64url>` for refresh
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomBytes, createHash } from 'node:crypto';
import type { PermissionCode } from './permissions';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 min per `30 §4.6.1`

/** Standard Shopio JWT claims per `30 §5.6`. */
export interface ShopioJwtClaims extends JWTPayload {
  /** user.id (UUID) */
  sub: string;
  /** tenant.id (UUID) — current tenant context */
  tnt: string;
  /** Effective permission codes */
  permissions: readonly PermissionCode[];
  /** Scope label */
  scope: 'admin' | 'customer' | 'agent' | 'service';
  /** session.assurance_level */
  assurance_level: 'low' | 'mfa_verified' | 'step_up';
  /** session.id */
  session_id: string;
}

/**
 * Sign an access token (JWT HS256).
 *
 * @param jwtSecret — minimum 32 bytes recommended. Per `30 §RULE-SEC-003` stored in KMS in prod.
 */
export async function signAccessToken(
  claims: Omit<ShopioJwtClaims, 'iat' | 'exp' | 'iss' | 'aud'>,
  jwtSecret: string,
  options: { issuer?: string; audience?: string; ttlSeconds?: number } = {},
): Promise<{ token: string; expiresInSeconds: number; expiresAt: Date }> {
  const ttl = options.ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttl * 1000);
  const secret = new TextEncoder().encode(jwtSecret);

  const jwt = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(options.issuer ?? 'shopio.com')
    .setAudience(options.audience ?? 'api.shopio.com')
    .setExpirationTime(`${ttl}s`)
    .sign(secret);

  return { token: jwt, expiresInSeconds: ttl, expiresAt };
}

/**
 * Verify and decode an access token.
 *
 * @throws JOSEError if invalid/expired/wrong issuer/audience
 */
export async function verifyAccessToken(
  token: string,
  jwtSecret: string,
  options: { issuer?: string; audience?: string } = {},
): Promise<ShopioJwtClaims> {
  const secret = new TextEncoder().encode(jwtSecret);
  const { payload } = await jwtVerify(token, secret, {
    issuer: options.issuer ?? 'shopio.com',
    audience: options.audience ?? 'api.shopio.com',
  });
  return payload as ShopioJwtClaims;
}

/**
 * Generate a refresh token (opaque random).
 * Format: `sho_rt_<43 base64url chars>` (~32 bytes entropy).
 *
 * Returns plaintext + sha256 hash for storage (per `30 §4.2`).
 * The plaintext goes in HTTP-only cookie; only the hash is stored in DB.
 */
export function generateRefreshToken(): { plaintext: string; sha256Hash: string } {
  const raw = randomBytes(32);
  const base = raw.toString('base64url');
  const plaintext = `sho_rt_${base}`;
  const sha256Hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, sha256Hash };
}

/** Hash an existing refresh token plaintext (for lookup). */
export function hashRefreshToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Generate a NanoID-style pub_id for an entity.
 * Per `05-naming-conventions.md` ID prefix system.
 *
 * Format: `{prefix}_{base62 random 12 chars}` — e.g., `usr_aB3xY7zM9qPv`.
 */
export function generatePubId(prefix: string): string {
  const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(12);
  let id = '';
  for (const byte of bytes) {
    id += ALPHABET[byte % ALPHABET.length];
  }
  return `${prefix}_${id}`;
}
