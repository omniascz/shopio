/**
 * Database singleton for API requests.
 */

import { createDbClient } from '@shopio/db';
import type { ShopioConfig } from './config';

let _db: ReturnType<typeof createDbClient> | null = null;

export function getDb(config: ShopioConfig) {
  if (!_db) {
    _db = createDbClient(config.DATABASE_URL);
  }
  return _db;
}

export type AppDb = ReturnType<typeof getDb>;
