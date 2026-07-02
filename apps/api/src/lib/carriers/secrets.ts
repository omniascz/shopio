/**
 * Encrypt carrier credentials at rest (per `30-security.md`, Fáze 1) — the same
 * AES-256-GCM helper the payment configs use, applied to the secret-bearing
 * keys inside `shipping_provider_configs.options` (Packeta api_password /
 * widget api_key / webhook_secret). A DB dump then can't leak live carrier keys.
 *
 * `sealCarrierOptions` is idempotent (already-encrypted values are left alone),
 * so the read-merge-write pattern in the settings route is safe. Backward
 * compatible: with no SHOPIO_SECRET_KEY it is passthrough, and `openSecret`
 * returns legacy plaintext unchanged.
 */

import { openSecret, sealSecret } from '../secrets';
import type { ShopioConfig } from '../../config';

/** Option keys treated as secrets (encrypted at rest, decrypted on use). */
const SECRET_OPTION_KEYS = new Set([
  'api_password',
  'api_key',
  'api_token',
  'api_secret',
  'secret',
  'password',
  'client_secret',
  'token',
  'webhook_secret',
]);

const ENC_PREFIX = 'enc:v1:';

/** Seal secret-keyed string values for storage. Skips already-sealed values. */
export function sealCarrierOptions(
  config: ShopioConfig,
  options: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(options)) {
    if (SECRET_OPTION_KEYS.has(k) && typeof v === 'string' && v !== '' && !v.startsWith(ENC_PREFIX)) {
      out[k] = sealSecret(config, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Decrypt secret-keyed values for use. Non-secret keys pass through. */
export function openCarrierOptions(
  config: ShopioConfig,
  options: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(options)) {
    out[k] = SECRET_OPTION_KEYS.has(k) && typeof v === 'string' ? openSecret(config, v) : v;
  }
  return out;
}
