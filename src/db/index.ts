import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Supabase: use the *transaction pooler* string (port 6543) here. Local dev: docker compose up db.
const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/giftfit';
const local = /@(localhost|127\.0\.0\.1|db)(:|\/)/.test(url);

// Reuse one client across hot reloads and warm serverless invocations.
const g = globalThis as unknown as { __giftfitPg?: ReturnType<typeof postgres> };
export const client = g.__giftfitPg ??= postgres(url, {
  prepare: false,                       // required by Supabase's transaction pooler
  ssl: local ? false : 'require',
  max: process.env.VERCEL ? 1 : 10,     // one connection per serverless instance; the pooler fans in
  idle_timeout: 20,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
export { schema };
