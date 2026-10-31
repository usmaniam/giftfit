import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSessionByToken } from '@/lib/sessions';
import { setReaction } from '@/lib/events';

const Body = z.object({ itemId: z.string().min(1), reaction: z.enum(['heart', 'veto']).nullable() });

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const s = await getSessionByToken((await params).token);
  if (!s) return Response.json({ error: 'not_found' }, { status: 404 });
  if (s.mode !== 'copick') return Response.json({ error: 'not_copick' }, { status: 409 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_input' }, { status: 400 });
  const { itemId, reaction } = parsed.data;
  const [[pick], [rendered]] = await Promise.all([
    db.select().from(schema.picks).where(and(eq(schema.picks.sessionId, s.id), eq(schema.picks.itemId, itemId))),
    db.select().from(schema.renders).where(and(eq(schema.renders.sessionId, s.id), eq(schema.renders.itemId, itemId), eq(schema.renders.status, 'success'))),
  ]);
  if (!pick || !rendered) return Response.json({ error: 'not_found' }, { status: 404 });
  await db.update(schema.picks).set({ recipientReaction: reaction }).where(eq(schema.picks.id, pick.id));
  await setReaction(s.id, itemId, reaction);
  return Response.json({ ok: true, itemId, reaction });
}
