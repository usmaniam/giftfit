import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSessionByToken } from '@/lib/sessions';
import { ADAPTERS } from '@/lib/render/adapters';

export const dynamic = 'force-dynamic';

/** Co-pick only: the recipient reviews previews of themselves. In surprise mode this is always empty by design. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const s = await getSessionByToken((await params).token);
  if (!s) return Response.json({ error: 'not_found' }, { status: 404 });
  if (s.mode !== 'copick') return Response.json({ mode: s.mode, items: [] });
  const rows = (await db.select({ k: schema.picks, i: schema.catalogItems, r: schema.renders }).from(schema.picks)
    .innerJoin(schema.catalogItems, eq(schema.catalogItems.id, schema.picks.itemId))
    .innerJoin(schema.renders, and(eq(schema.renders.sessionId, schema.picks.sessionId), eq(schema.renders.itemId, schema.picks.itemId), eq(schema.renders.status, 'success')))
    .where(eq(schema.picks.sessionId, s.id))).sort((a, b) => a.k.rank - b.k.rank);
  return Response.json({
    mode: s.mode, giverName: s.giverName,
    items: rows.map(({ k, i, r }) => ({ renderId: r.id, itemId: i.id, name: i.name, category: i.category, price: i.price, kind: ADAPTERS[i.category].kind, reaction: k.recipientReaction })),
  });
}
