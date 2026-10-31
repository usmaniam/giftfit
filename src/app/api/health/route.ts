import { db, schema } from '@/db';
import { count } from 'drizzle-orm';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const [{ n }] = await db.select({ n: count() }).from(schema.catalogItems);
    return Response.json({ ok: true, demoMode: config.demoMode, catalogItems: n, storage: config.storageDriver });
  } catch {
    return Response.json({ ok: false, error: 'database_unreachable' }, { status: 503 });
  }
}
