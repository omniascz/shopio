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

export * from './permissions.js';
export * from './personas.js';
export * from './check.js';
