/**
 * Shared schema helpers — used across all tables.
 * Per `05-naming-conventions.md` ID prefix system.
 */

import { customType } from 'drizzle-orm/pg-core';

/**
 * UUIDv7 column type — time-sortable + collision-resistant.
 * Per `03-data-models-master.md`. Requires Postgres 17 + uuidv7() function.
 */
export const uuidv7 = customType<{ data: string; driverData: string }>({
  dataType() {
    return `uuid DEFAULT uuidv7()`;
  },
});

/** Standard timestamp columns helper. */
export function timestamps() {
  return {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };
}
