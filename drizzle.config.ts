import { defineConfig } from 'drizzle-kit';

// For Supabase, run db:push with the *direct* (or session-pooler) connection string, not the transaction pooler.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/giftfit',
    ssl: /@(localhost|127\.0\.0\.1|db)(:|\/)/.test(process.env.DATABASE_URL ?? 'localhost') ? false : 'require',
  },
});
