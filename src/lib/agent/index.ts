import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { config } from '../config';
import { ADAPTERS } from '../render/adapters';
import { newId } from '../tokens';
import { llmEnabled, rerank } from './llm';
import { rank, selectDiverse, sharedUndertone, type Cand } from './score';

type Session = typeof schema.giftSessions.$inferSelect;
type Profile = typeof schema.recipientProfiles.$inferSelect;
type Item = typeof schema.catalogItems.$inferSelect;
export type AgentStatus = 'cached' | 'llm' | 'rules:disabled' | `rules:${string}` | 'no_candidates';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Reasons shown to the giver must never echo the recipient's private limits. Fall back to rules text if they do. */
const leaks = (text: string, p: Profile) =>
  /\b(avoid\w*|boundar\w*|no-go|forbid\w*|not allowed|allowed|dislike\w*)\b/i.test(text) || p.avoidColors.some((c) => new RegExp(`\\b${c}\\b`, 'i').test(text));

function rulesText(c: Cand) {
  return { reason: cap(c.signals.join(', ') || 'a solid all-round choice') + '.', caveat: '' };
}

/** Honest labeling is enforced server-side, whatever the model wrote. */
function honest(caveat: string, item: Item): string {
  let out = clean(caveat) || (ADAPTERS[item.category].kind === 'scene' ? 'Style preview, not an exact fit.' : 'Preview only; real fit can differ.');
  if (ADAPTERS[item.category].kind === 'scene' && !/preview/i.test(out)) out += ' Style preview, not an exact fit.';
  if (item.category === 'ring' && !/size/i.test(out)) out += ' A preview can’t confirm ring size.';
  return out;
}

export async function runAgent(s: Session, p: Profile, opts: { count: number; refresh: boolean }) {
  const existing = await db.select().from(schema.picks).where(eq(schema.picks.sessionId, s.id));
  if (existing.length && !opts.refresh) return { status: 'cached' as AgentStatus, picks: existing };

  const catalog = await db.select().from(schema.catalogItems);
  const ranked = rank(catalog, p, s);
  if (!ranked.length) return { status: 'no_candidates' as AgentStatus, picks: [] };

  // Stage 3: one LLM call for the whole session (or fall back to the deterministic order).
  let status: AgentStatus = 'rules:disabled';
  let order = ranked;
  const llmText = new Map<string, { reason: string; caveat: string }>();
  if (llmEnabled()) {
    const r = await rerank({ occasion: s.occasion, budgetMin: s.budgetMin, budgetMax: s.budgetMax, undertone: sharedUndertone(p), candidates: ranked.map((c) => c.item) });
    if (r.ok) {
      status = 'llm';
      const byId = new Map(ranked.map((c) => [c.item.id, c]));
      const llmOrder = r.picks.map((x) => byId.get(x.itemId)!);
      order = [...llmOrder, ...ranked.filter((c) => !llmOrder.includes(c))];
      for (const x of r.picks) if (!leaks(x.reason + ' ' + x.caveat, p)) llmText.set(x.itemId, { reason: clean(x.reason), caveat: clean(x.caveat) });
    } else status = `rules:${r.why}`;
  }

  const count = Math.min(opts.count, config.maxRendersPerSession);
  const chosen = selectDiverse(order.map((c) => ({ ...c, category: c.item.category })), count);

  if (existing.length) await db.delete(schema.picks).where(eq(schema.picks.sessionId, s.id));
  const rows = chosen.map((c, i) => {
    const t = llmText.get(c.item.id);
    const base = t ?? rulesText(c);
    return {
      id: newId(), sessionId: s.id, itemId: c.item.id, rank: i + 1, reasonText: base.reason,
      caveatText: honest(base.caveat, c.item), source: (t ? 'llm' : 'rules') as 'llm' | 'rules', score: c.score, signals: c.signals,
    };
  });
  await db.insert(schema.picks).values(rows);
  return { status, picks: rows };
}
