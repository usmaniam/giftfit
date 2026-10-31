import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { config } from '@/lib/config';
import { getSession } from '@/lib/sessions';
import { ensureProfile } from '@/lib/profile';
import { runAgent } from '@/lib/agent';
import { ADAPTERS } from '@/lib/render/adapters';
import { requestRenders } from '@/lib/render/request';
import { giverVisibility } from '@/lib/render/visibility';

export const dynamic = 'force-dynamic';
const Body = z.object({ sessionId: z.string().min(1), count: z.number().int().min(1).max(config.maxRendersPerSession).default(6), refresh: z.boolean().default(false), render: z.boolean().default(false) });

/** What the giver may see. Surprise: all picks. Co-pick: only hearted ones. Boundary-revealing details are never included. */
async function view(sessionId: string) {
  const [rows, canSee] = await Promise.all([
    db.select({ k: schema.picks, i: schema.catalogItems }).from(schema.picks)
      .innerJoin(schema.catalogItems, eq(schema.catalogItems.id, schema.picks.itemId)).where(eq(schema.picks.sessionId, sessionId)),
    giverVisibility(sessionId),
  ]);
  return rows.filter(({ k }) => canSee(k.itemId)).sort((a, b) => a.k.rank - b.k.rank).map(({ k, i }) => ({
    itemId: i.id, name: i.name, category: i.category, price: i.price, rank: k.rank, reason: k.reasonText, caveat: k.caveatText,
    source: k.source, kind: ADAPTERS[i.category].kind, signals: k.signals,
  }));
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_input' }, { status: 400 });
  const s = await getSession(parsed.data.sessionId);
  if (!s || s.status === 'deleted') return Response.json({ error: 'not_found' }, { status: 404 });
  const p = await ensureProfile(s.id);
  if (!p.consentRender || !p.selfieAssetId || s.status === 'created' || s.status === 'invited') return Response.json({ error: 'recipient_not_ready' }, { status: 409 });
  if (parsed.data.refresh && (await db.select({ id: schema.renders.id }).from(schema.renders).where(eq(schema.renders.sessionId, s.id)).limit(1)).length) {
    return Response.json({ error: 'refresh_not_allowed_after_rendering' }, { status: 409 });
  }

  const run = await runAgent(s, p, parsed.data);
  const renders = parsed.data.render && run.picks.length ? await requestRenders(s, p, run.picks.sort((a, b) => a.rank - b.rank).map((x) => x.itemId)) : undefined;
  return Response.json({
    status: run.status, proposed: run.picks.length, picks: await view(s.id), renders,
    trace: { llmUsed: run.picks.some((x) => x.source === 'llm'), note: 'Candidates are filtered by the recipient’s limits on the server before ranking. Those limits are not shown to you.' },
  });
}

export async function GET(req: Request) {
  const s = await getSession(new URL(req.url).searchParams.get('sessionId') ?? '');
  if (!s || s.status === 'deleted') return Response.json({ error: 'not_found' }, { status: 404 });
  const all = await db.select().from(schema.picks).where(eq(schema.picks.sessionId, s.id));
  return Response.json({ picks: await view(s.id), started: all.length > 0, awaitingReview: s.mode === 'copick' ? all.filter((k) => !k.recipientReaction).length : 0 });
}
