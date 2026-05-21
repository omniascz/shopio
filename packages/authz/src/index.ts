/**
 * @shopio/authz — Authorization library.
 *
 * Per `36-personas-rbac.md`. Implements:
 * - Permission catalog (~180 PERM-* codes)
 * - Persona definitions (40+ personas)
 * - Permission check helpers (RBAC)
 * - ABAC policy engine
 * - JWT permission claim builder
 */

export * from './permissions';
export * from './personas';
export * from './check';
export * from './password';
export * from './tokens';
export * from './sessions';
