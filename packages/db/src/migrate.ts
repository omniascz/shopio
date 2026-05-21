/**
 * Custom migration runner.
 *
 * Sequence:
 *   1. Run `_pre-migration.sql` (uuidv7() function + extensions)
 *   2. Run all Drizzle-generated migrations in drizzle/ via drizzle-orm migrator
 *
 * Run: `pnpm db:migrate`
 */

import { config as loadEnv } from 'dotenv';
import { existsSync as fsExists } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRE_MIGRATION_FILE = resolve(__dirname, '..', 'drizzle', '_pre-migration.sql');
const MIGRATIONS_DIR = resolve(__dirname, '..', 'drizzle');

// Load .env from package, parent, or workspace root
for (const candidate of [
  resolve(__dirname, '..', '.env'),
  resolve(__dirname, '..', '..', '..', '.env'),
]) {
  if (fsExists(candidate)) {
    loadEnv({ path: candidate });
    break;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    // Step 1: pre-migration SQL (uuidv7 function, extensions)
    if (fsExists(PRE_MIGRATION_FILE)) {
      console.log('📜 Running pre-migration SQL (uuidv7 + extensions)...');
      const preSql = await readFile(PRE_MIGRATION_FILE, 'utf-8');
      await sql.unsafe(preSql);
      console.log('   ✅ Pre-migration applied');
    }

    // Step 2: Drizzle migrations
    console.log('📦 Running Drizzle migrations...');
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    console.log('   ✅ All migrations applied');

    // Step 3: verification
    console.log('🔍 Verifying schema...');
    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log(
      `   ✅ ${tables.length} tables present: ${tables.map((t) => t.table_name).join(', ')}`,
    );

    const sampleId = await sql<{ id: string }[]>`SELECT uuidv7() AS id`;
    console.log(`   ✅ uuidv7() works: ${sampleId[0]?.id}`);

    console.log('✨ Migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
