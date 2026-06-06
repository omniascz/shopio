/**
 * Row-Level Security helpers (per `30-security.md`).
 *
 * `withTenant` runs a callback inside a transaction with `app.current_tenant_id`
 * set transaction-locally, so the RLS policies installed by migration
 * `0020_rls_tenant_isolation` confine every query to that tenant. MUST be used
 * with a connection that authenticates as the non-superuser `shopio_app` role —
 * a superuser connection bypasses RLS entirely.
 *
 * The tenant id is set via `set_config(..., is_local => true)`, so it is scoped
 * to the transaction and never leaks to the next user of a pooled connection.
 */

import { sql } from 'drizzle-orm';
import type { ShopioDbClient } from './client';

/** Transaction handle passed to the callback (same surface as the client). */
export type TenantTx = Parameters<Parameters<ShopioDbClient['transaction']>[0]>[0];

export async function withTenant<T>(
  db: ShopioDbClient,
  tenantId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}
