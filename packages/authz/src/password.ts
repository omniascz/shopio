/**
 * Password hashing + verification.
 *
 * Per `30-security.md §4.3` + `RULE-SEC-008`:
 * - argon2id (m=64MB, t=3, p=4)
 * - Server-side pepper combined before hashing
 * - Min 12 chars
 * - HIBP check at signup (TODO Fáze 1 wave 2)
 */

import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id params per `30 §RULE-SEC-008`. Tune annually for ~250ms hash time.
 *
 * `algorithm: 2` = Argon2id per @node-rs/argon2 v2 (the enum can't be imported
 * with verbatimModuleSyntax — using numeric literal instead).
 */
const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
} as const;

const MIN_PASSWORD_LENGTH = 12;

export class PasswordPolicyError extends Error {
  constructor(
    message: string,
    public readonly code: 'too_short' | 'too_common' | 'matches_email' | 'weak',
  ) {
    super(message);
    this.name = 'PasswordPolicyError';
  }
}

/**
 * Validate password against policy. Throws on violation.
 * Does NOT check HIBP — caller should do that separately for performance.
 */
export function assertPasswordPolicy(password: string, email?: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordPolicyError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      'too_short',
    );
  }
  if (email && password.toLowerCase().includes(email.split('@')[0]!.toLowerCase())) {
    throw new PasswordPolicyError('Password must not contain your email', 'matches_email');
  }
  // TODO Fáze 1 wave 2: HIBP k-anonymity check
}

/**
 * Hash a password with optional server-side pepper.
 *
 * Pepper is per `30 §7.9` — stored separately from DB hash.
 * If no pepper supplied (dev mode), hashes plain password (less secure but functional).
 *
 * @returns argon2 PHC-format string ready for DB storage
 */
export async function hashPassword(password: string, pepper?: string): Promise<string> {
  const input = pepper ? password + pepper : password;
  return hash(input, ARGON2_OPTIONS);
}

/**
 * Verify a password against stored argon2 hash.
 * Returns true on match; false otherwise (does NOT throw).
 *
 * Constant-time comparison via @node-rs/argon2 native binding.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  pepper?: string,
): Promise<boolean> {
  try {
    const input = pepper ? password + pepper : password;
    return await verify(storedHash, input);
  } catch {
    return false;
  }
}
