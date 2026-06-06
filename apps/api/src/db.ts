/**
 * Database singleton for API requests.
 */

import { createDbClient } from '@shopio/db';
import type { ShopioConfig } from './config';

let _db: ReturnType<typeof createDbClient> | null = null;
let _rlsDb: ReturnType<typeof createDbClient> | null = null;

export function getDb(config: ShopioConfig) {
  if (!_db) {
    _db = createDbClient(config.DATABASE_URL);
  }
  return _db;
}

/**
 * RLS-enforced pool (per `30`): connects as the non-superuser `shopio_app`
 * role so the tenant-isolation policies apply. Used via `withTenant`. Falls
 * back to the main (superuser) connection when DATABASE_URL_APP is unset, in
 * which case RLS is dormant — explicit tenant filters remain the guard.
 */
export function getRlsDb(config: ShopioConfig) {
  if (!_rlsDb) {
    _rlsDb = config.DATABASE_URL_APP
      ? createDbClient(config.DATABASE_URL_APP)
      : getDb(config);
  }
  return _rlsDb;
}

export type AppDb = ReturnType<typeof getDb>;
