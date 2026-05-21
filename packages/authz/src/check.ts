import type { PermissionCode } from './permissions.js';

/** Auth context per request. */
export type AuthContext = {
  userId: string;
  tenantId: string;
  permissions: readonly PermissionCode[];
  assuranceLevel: 'low' | 'mfa_verified' | 'step_up';
  sessionId: string;
};

/** Check if context has permission. */
export function can(ctx: AuthContext, permission: PermissionCode): boolean {
  return ctx.permissions.includes(permission);
}

/** Check if context has any of the given permissions. */
export function canAny(ctx: AuthContext, permissions: PermissionCode[]): boolean {
  return permissions.some((p) => ctx.permissions.includes(p));
}

/** Check if context has all of the given permissions. */
export function canAll(ctx: AuthContext, permissions: PermissionCode[]): boolean {
  return permissions.every((p) => ctx.permissions.includes(p));
}

/** Throws if permission missing. Use in handlers. */
export function requirePermission(ctx: AuthContext, permission: PermissionCode): void {
  if (!can(ctx, permission)) {
    throw new PermissionDeniedError(permission);
  }
}

export class PermissionDeniedError extends Error {
  constructor(public readonly required: PermissionCode) {
    super(`Permission denied: requires ${required}`);
    this.name = 'PermissionDeniedError';
  }
}
