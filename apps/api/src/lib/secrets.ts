/**
 * Secret-at-rest encryption (per `30-security.md`) — AES-256-GCM with the
 * platform key (config.SHOPIO_SECRET_KEY). Used to encrypt stored gateway
 * credentials (payment provider API keys/secrets) so a DB dump doesn't leak
 * live keys.
 *
 * Backward + forward compatible by design:
 * - No key configured → passthrough (plaintext). Dev/CI behave exactly as
 *   before; nothing breaks.
 * - `openSecret` only decrypts values with the `enc:v1:` prefix; anything else
 *   (legacy plaintext) is returned as-is. So enabling the key later transparently
 *   re-encrypts on the next write while old rows keep working.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { ShopioConfig } from '../config';

const PREFIX = 'enc:v1:';

function keyBuf(config: ShopioConfig): Buffer | null {
  return config.SHOPIO_SECRET_KEY ? Buffer.from(config.SHOPIO_SECRET_KEY, 'hex') : null;
}

/** Encrypt a string for storage. Passthrough when no key is configured. */
export function sealSecret(config: ShopioConfig, plaintext: string): string {
  const key = keyBuf(config);
  if (!key || plaintext === '') return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Decrypt a stored value. Returns legacy/plaintext values unchanged. */
export function openSecret(config: ShopioConfig, stored: string | null | undefined): string {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const key = keyBuf(config);
  if (!key) {
    // Encrypted value but no key — cannot decrypt; fail closed (empty).
    return '';
  }
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

/** Seal every string value in a credentials map (non-strings left as-is). */
export function sealCredentials(
  config: ShopioConfig,
  creds: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(creds)) {
    out[k] = typeof v === 'string' ? sealSecret(config, v) : v;
  }
  return out;
}

/** Open every string value in a credentials map. */
export function openCredentials(
  config: ShopioConfig,
  creds: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) {
    if (typeof v === 'string') out[k] = openSecret(config, v);
  }
  return out;
}
