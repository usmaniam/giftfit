import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { giverCanSee } from '@/lib/render/visibility';
import { serveRender } from '@/lib/render/serve';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = db.select().from(schema.renders).where(eq(schema.renders.id, (await params).id)).get();
  if (!r || r.status !== 'success' || !r.resultAssetId || !giverCanSee(r.sessionId, r.itemId)) return new Response(null, { status: 404 });
  return serveRender(r.resultAssetId);
}
