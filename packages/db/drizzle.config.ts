import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/*.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://shopio:shopio_dev_password@localhost:5432/shopio_dev',
  },
  strict: true,
  verbose: true,
  casing: 'snake_case',
});
