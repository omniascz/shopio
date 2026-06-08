/**
 * Pure-function tests for OAuth helpers (per `28`). Scope mapping + token
 * shapes; the DB-backed authorize/token flow is covered by the app.inject smoke.
 */

import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_PREFIX,
  generateAccessToken,
  generateClientId,
  hashToken,
  isOAuthAccessToken,
  isValidScope,
  scopesToPermissions,
} from './oauth';

describe('scope catalog', () => {
  it('validates known + unknown scopes', () => {
    expect(isValidScope('full')).toBe(true);
    expect(isValidScope('orders:read')).toBe(true);
    expect(isValidScope('nope')).toBe(false);
  });

  it('maps full → ADMIN_FULL', () => {
    expect(scopesToPermissions(['full'])).toContain('PERM-ADMIN-FULL');
  });

  it('expands + dedupes granular scopes', () => {
    const perms = scopesToPermissions(['catalog:read', 'catalog:write']);
    expect(perms).toContain('PERM-PRODUCT-VIEW');
    expect(perms).toContain('PERM-PRODUCT-EDIT');
    // PRODUCT_VIEW appears in both scopes but only once.
    expect(perms.filter((p) => p === 'PERM-PRODUCT-VIEW')).toHaveLength(1);
  });

  it('ignores unknown scopes when mapping', () => {
    expect(scopesToPermissions(['bogus'])).toEqual([]);
  });
});

describe('token helpers', () => {
  it('generates prefixed access tokens recognized by the guard', () => {
    const t = generateAccessToken();
    expect(t.raw.startsWith(ACCESS_TOKEN_PREFIX)).toBe(true);
    expect(isOAuthAccessToken(t.raw)).toBe(true);
    expect(t.hash).toBe(hashToken(t.raw));
    expect(t.hint).toHaveLength(4);
  });

  it('client ids are prefixed', () => {
    expect(generateClientId().startsWith('shpca_')).toBe(true);
  });
});
