import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type ShopioDbClient = ReturnType<typeof createDbClient>;

export function createDbClient(connectionString: string) {
  const sql = postgres(connectionString, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false,
  });
  return drizzle(sql, { schema, logger: process.env.NODE_ENV !== 'production' });
}
