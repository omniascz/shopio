import { describe, expect, it } from 'vitest';
import { assertPasswordPolicy, hashPassword, PasswordPolicyError, verifyPassword } from './password';

describe('password', () => {
  describe('assertPasswordPolicy', () => {
    it('accepts valid password', () => {
      expect(() => assertPasswordPolicy('a-very-long-passphrase-here')).not.toThrow();
    });

    it('rejects too-short password', () => {
      expect(() => assertPasswordPolicy('short')).toThrow(PasswordPolicyError);
      try {
        assertPasswordPolicy('short');
      } catch (err) {
        expect((err as PasswordPolicyError).code).toBe('too_short');
      }
    });

    it('rejects password matching email local-part', () => {
      expect(() =>
        assertPasswordPolicy('myusername-is-long-enough', 'myusername@example.com'),
      ).toThrow(PasswordPolicyError);
    });
  });

  describe('hashPassword + verifyPassword', () => {
    it('round-trip succeeds', async () => {
      const hash = await hashPassword('correct-horse-battery-staple');
      expect(hash).toMatch(/^\$argon2id\$/);
      expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
    });

    it('verify fails on wrong password', async () => {
      const hash = await hashPassword('correct-horse-battery-staple');
      expect(await verifyPassword('wrong-password', hash)).toBe(false);
    });

    it('pepper changes hash output', async () => {
      const h1 = await hashPassword('passphrase-here-pls', 'pepper-1');
      const h2 = await hashPassword('passphrase-here-pls', 'pepper-2');
      expect(h1).not.toBe(h2);
      expect(await verifyPassword('passphrase-here-pls', h1, 'pepper-1')).toBe(true);
      expect(await verifyPassword('passphrase-here-pls', h1, 'pepper-2')).toBe(false);
    });

    it('rejects malformed hash gracefully', async () => {
      expect(await verifyPassword('any', 'not-a-real-hash')).toBe(false);
    });
  });
});
