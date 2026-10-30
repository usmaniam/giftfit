import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { config } from '@/lib/config';
import { getSession } from '@/lib/sessions';
import { ensureProfile } from '@/lib/profile';
import { ADAPTERS } from '@/lib/render/adapters';
import { requestRenders } from '@/lib/render/request';
import { pollRender } from '@/lib/render/queue';
import { giverCanSee } from '@/lib/render/visibility';

export const dynamic = 'force-dynamic';
const Body = z.object({ sessionId: z.string().min(1), itemIds: z.array(z.string()).min(1).max(config.maxRendersPerSession) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_input' }, { status: 400 });
  const s = getSession(parsed.data.sessionId);
  if (!s || s.status === 'deleted') return Response.json({ error: 'not_found' }, { status: 404 });
  const result = await requestRenders(s, ensureProfile(s.id), parsed.data.itemIds);
  if ('error' in result) return Response.json({ error: result.error }, { status: result.httpStatus });
  return Response.json(result, { status: result.accepted.length ? 202 : 200 });
}

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get('sessionId') ?? '';
  const s = getSession(sessionId);
  if (!s || s.status === 'deleted') return Response.json({ error: 'not_found' }, { status: 404 });
  // Advance anything still in flight, so a single list poll is enough to drive the whole queue.
  const open = db.select().from(schema.renders).where(and(eq(schema.renders.sessionId, s.id), inArray(schema.renders.status, ['queued', 'running']))).all();
  await Promise.all(open.map((r) => pollRender(r.id)));
  const rows = db.select({ r: schema.renders, i: schema.catalogItems }).from(schema.renders)
    .innerJoin(schema.catalogItems, eq(schema.catalogItems.id, schema.renders.itemId))
    .where(eq(schema.renders.sessionId, s.id)).all()
    .filter(({ r }) => giverCanSee(s.id, r.itemId));
  return Response.json({
    demo: config.demoMode,
    renders: rows.map(({ r, i }) => ({
      id: r.id, itemId: i.id, name: i.name, category: i.category, price: i.price, status: r.status, errorCode: r.errorCode,
      kind: ADAPTERS[i.category].kind,
    })),
  });
}
