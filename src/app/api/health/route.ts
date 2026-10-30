import { db, schema } from '@/db';
import { count } from 'drizzle-orm';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';
export function GET() {
  const [{ n }] = db.select({ n: count() }).from(schema.catalogItems).all();
  return Response.json({ ok: true, demoMode: config.demoMode, catalogItems: n });
}
