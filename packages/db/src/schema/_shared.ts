/**
 * Shared schema helpers — used across all tables.
 *
 * Note: `uuidv7()` Postgres function is NOT native to Postgres 17. We install a
 * custom plpgsql implementation in the first migration (`0000_init.sql`).
 *
 * Schemas use `default(sql`uuidv7()`)` directly via Drizzle's pg-core uuid().
 */

import { sql } from 'drizzle-orm';

/** Convenience: standard `created_at` + `updated_at` timestamp columns helper. */
export const timestamps = sql`now()`;
