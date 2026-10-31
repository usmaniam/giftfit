import { db, schema } from '@/db';
import { count } from 'drizzle-orm';
import { config } from '@/lib/config';
import { purgeExpired } from '@/lib/privacy';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Retention sweep: platform health checks hit this every ~30s, so photos and previews are deleted soon after
  // the recipient's chosen expiry even when nobody opens a link. A sweep failure must not fail the health check.
  await purgeExpired().catch(() => {});
  const [{ n }] = db.select({ n: count() }).from(schema.catalogItems).all();
  return Response.json({ ok: true, demoMode: config.demoMode, catalogItems: n });
}
