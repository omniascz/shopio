/**
 * API key helpers (per `28-developer-platform.md` MVP).
 *
 * Plaintext key is shown once at creation; only sha256(key) is stored. Lookup
 * runs on the superuser pool (auth bootstrap — the key determines the tenant,
 * so it precedes any RLS tenant context), mirroring JWT verification.
 */

import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema } from '@shopio/db';
import type { AppDb } from '../db';

const KEY_PREFIX = 'sk_live_';

export function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Generate a new key → { raw (show once), prefix, hint, hash }. */
export function generateApiKey(): { raw: string; prefix: string; hint: string; hash: string } {
  const secret = randomBytes(24).toString('base64url');
  const raw = `${KEY_PREFIX}${secret}`;
  return { raw, prefix: KEY_PREFIX, hint: raw.slice(-4), hash: hashKey(raw) };
}

export function isApiKey(token: string): boolean {
  return token.startsWith(KEY_PREFIX);
}

/** Resolve an API key (superuser pool). Returns the active key row or null. */
export async function resolveApiKey(
  db: AppDb,
  raw: string,
): Promise<typeof schema.apiKeys.$inferSelect | null> {
  if (!isApiKey(raw)) return null;
  const [key] = await db
    .select()
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.keyHash, hashKey(raw)))
    .limit(1);
  if (!key || key.status !== 'active') return null;
  // Sliding last-used (best-effort, off the request path).
  void db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, key.id))
    .catch(() => {});
  return key;
}

export function serializeApiKey(k: typeof schema.apiKeys.$inferSelect) {
  return {
    id: k.pubId,
    name: k.name,
    key_prefix: k.keyPrefix,
    key_hint: k.keyHint,
    permissions: k.permissions,
    status: k.status,
    last_used_at: k.lastUsedAt,
    created_at: k.createdAt,
  };
}
