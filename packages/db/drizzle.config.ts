import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url =
  process.env.DATABASE_URL ??
  'postgres://shopio:shopio_dev_password@localhost:5435/shopio_dev';

export default defineConfig({
  dialect: 'postgresql',
  // Explicit list — exclude barrel index.ts (which uses .js ESM extensions
  // that drizzle-kit's CJS loader can't resolve).
  schema: [
    './src/schema/tenants.ts',
    './src/schema/users.ts',
    './src/schema/sessions.ts',
    './src/schema/audit-log-entries.ts',
  ],
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
  verbose: true,
  casing: 'snake_case',
  schemaFilter: ['public'],
});
