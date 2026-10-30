import { config } from '@/lib/config';
import { pollRender } from '@/lib/render/queue';
import { giverCanSee } from '@/lib/render/visibility';
import { ADAPTERS } from '@/lib/render/adapters';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await pollRender((await params).id);
  if (!r || !giverCanSee(r.sessionId, r.itemId)) return Response.json({ error: 'not_found' }, { status: 404 });
  const item = db.select().from(schema.catalogItems).where(eq(schema.catalogItems.id, r.itemId)).get()!;
  return Response.json({
    id: r.id, itemId: r.itemId, status: r.status, errorCode: r.errorCode, demo: config.demoMode,
    kind: ADAPTERS[item.category].kind, resultUrl: r.status === 'success' ? `/api/renders/${r.id}/image` : null,
  });
}
