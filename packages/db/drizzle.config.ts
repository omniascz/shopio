import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url =
  process.env.DATABASE_URL ?? 'postgres://shopio:shopio_dev_password@localhost:5435/shopio_dev';

export default defineConfig({
  dialect: 'postgresql',
  // Explicit list — exclude barrel index.ts (which uses .js ESM extensions
  // that drizzle-kit's CJS loader can't resolve).
  schema: [
    './src/schema/tenants.ts',
    './src/schema/users.ts',
    './src/schema/sessions.ts',
    './src/schema/audit-log-entries.ts',
    './src/schema/categories.ts',
    './src/schema/products.ts',
    './src/schema/product-variants.ts',
    './src/schema/product-media.ts',
    './src/schema/product-categories.ts',
    './src/schema/carts.ts',
    './src/schema/orders.ts',
    './src/schema/tax-rates.ts',
    './src/schema/shipping.ts',
    './src/schema/invoices.ts',
    './src/schema/returns.ts',
    './src/schema/shipments.ts',
    './src/schema/inventory.ts',
    './src/schema/customers.ts',
    './src/schema/reviews.ts',
    './src/schema/coupons.ts',
    './src/schema/companies.ts',
    './src/schema/channels.ts',
    './src/schema/translations.ts',
    './src/schema/cms.ts',
  ],
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
  verbose: true,
  casing: 'snake_case',
  schemaFilter: ['public'],
});
