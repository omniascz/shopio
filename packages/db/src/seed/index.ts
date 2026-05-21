/**
 * Seed script — populates dev environment with sample data.
 * Per `38-deployment-guide.md §3.4` default credentials.
 *
 * Run: `pnpm db:seed`
 */

import { createDbClient } from '../client.js';

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const _db = createDbClient(url); // reserved for Fáze 1 seed implementation

  console.log('🌱 Seeding Shopio dev database...');

  // TODO Fáze 0 → Fáze 1: insert sample tenant, admin user, products
  console.log('  ⚠ Seed data not yet implemented (skeleton only).');
  console.log('  → Will populate during Fáze 1 Wave 1 (core platform).');

  console.log('✅ Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
