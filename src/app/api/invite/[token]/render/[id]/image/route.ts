import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSessionByToken } from '@/lib/sessions';
import { serveRender } from '@/lib/render/serve';

// The recipient may view renders of themselves, but only in co-pick mode and only within their own session.
export async function GET(_: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const s = getSessionByToken(token);
  if (!s || s.mode !== 'copick') return new Response(null, { status: 404 });
  const r = db.select().from(schema.renders).where(and(eq(schema.renders.id, id), eq(schema.renders.sessionId, s.id), eq(schema.renders.status, 'success'))).get();
  return r?.resultAssetId ? serveRender(r.resultAssetId) : new Response(null, { status: 404 });
}
