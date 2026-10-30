import Link from 'next/link';
import { db, schema } from '@/db';
import { h1 } from '@/components/ui';

export const dynamic = 'force-dynamic';
type Ev = typeof schema.merchantEvents.$inferSelect;
const MIN_REACTIONS = 5; // below this, a percentage would mislead
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function summarize(events: Ev[], cat: Map<string, string>) {
  const sessions = new Set(events.filter((e) => e.type === 'preview').map((e) => e.sessionId));
  const count = (t: Ev['type']) => events.filter((e) => e.type === t).length;
  const hearts = count('heart'), vetoes = count('veto'), purchases = count('purchase');
  const by = new Map<string, { previews: number; hearts: number; vetoes: number; purchases: number }>();
  for (const e of events) {
    const c = cat.get(e.itemId ?? '') ?? 'other';
    const row = by.get(c) ?? { previews: 0, hearts: 0, vetoes: 0, purchases: 0 };
    if (e.type === 'preview') row.previews++; else if (e.type === 'heart') row.hearts++; else if (e.type === 'veto') row.vetoes++; else row.purchases++;
    by.set(c, row);
  }
  return {
    sessions: sessions.size, previews: count('preview'), hearts, vetoes, purchases,
    approval: hearts + vetoes ? Math.round((hearts / (hearts + vetoes)) * 100) : null,
    conversion: sessions.size ? Math.round((purchases / sessions.size) * 100) : null,
    byCategory: [...by.entries()].map(([category, v]) => ({ category, ...v, rate: v.hearts + v.vetoes >= MIN_REACTIONS ? Math.round((v.hearts / (v.hearts + v.vetoes)) * 100) : null })).sort((a, b) => b.previews - a.previews),
  };
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (<div className="rounded-2xl border-[1.5px] border-tissue p-4"><div className="text-sm text-muted">{label}</div><div className="font-display text-3xl">{value}</div>{sub && <div className="text-xs text-muted">{sub}</div>}</div>);
}

export default function Merchant() {
  const cat = new Map(db.select().from(schema.catalogItems).all().map((i) => [i.id, i.category]));
  const all = db.select().from(schema.merchantEvents).all();
  const demo = summarize(all.filter((e) => e.seeded), cat);
  const live = summarize(all.filter((e) => !e.seeded), cat);
  const latest = new Map<string, Ev>();
  for (const e of all.filter((x) => x.seeded).sort((a, b) => b.ts.getTime() - a.ts.getTime())) if (!latest.has(e.sessionId)) latest.set(e.sessionId, e);
  const recent = [...latest.values()].slice(0, 6);
  const label: Record<string, string> = { preview: 'previewed', heart: 'approved by recipient', veto: 'declined by recipient', purchase: 'purchased (mock)' };

  return (
    <>
      <p className="rounded-2xl bg-ribbon p-3 text-sm font-semibold text-white" role="note">Demo data. Seeded for illustration, not real customers.</p>
      <h1 className={h1}>Merchant view</h1>
      <p className="text-muted">What a retailer would see: who’s previewing their products as gifts, what recipients approve, and what converts. Anonymous: no names or photos.</p>

      <div className="my-5 grid grid-cols-2 gap-3">
        <Kpi label="Gift sessions" value={demo.sessions} sub="last 30 days" />
        <Kpi label="Previews shown" value={demo.previews} />
        <Kpi label="Recipient approval" value={demo.approval === null ? '–' : `${demo.approval}%`} sub="co-pick sessions" />
        <Kpi label="Mock conversion" value={demo.conversion === null ? '–' : `${demo.conversion}%`} sub={`${demo.purchases} purchases`} />
      </div>

      <h2 className="font-display mb-3 text-2xl">Approval rate by category</h2>
      <ul className="m-0 grid list-none gap-3 p-0">
        {demo.byCategory.map((c) => (
          <li key={c.category}>
            <div className="flex justify-between text-sm"><span className="font-semibold capitalize">{c.category}</span><span className="text-muted">{c.rate === null ? 'too few reactions' : `${c.rate}% approved`} · {c.previews} previews · {c.purchases} bought</span></div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-tissue" role="img" aria-label={`${c.category} approval ${c.rate ?? 0} percent`}><div className="h-full rounded-full bg-ribbon" style={{ width: `${c.rate ?? 0}%` }} /></div>
          </li>
        ))}
      </ul>

      <h2 className="font-display mt-8 mb-3 text-2xl">Recent activity (demo)</h2>
      <ul className="m-0 grid list-none gap-2 p-0 text-[15px]">
        {recent.map((e) => (<li key={e.id} className="flex justify-between gap-3 border-b border-tissue pb-2"><span>Session {e.sessionId.slice(-3)} · <span className="capitalize">{cat.get(e.itemId ?? '') ?? 'item'}</span> {label[e.type]}</span><span className="text-muted">{e.ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></li>))}
      </ul>

      <div className="mt-8 rounded-2xl border-[1.5px] border-tissue p-4">
        <b>Live on this instance (not seeded)</b>
        <p className="mb-0 text-[15px] text-muted">{plural(live.sessions, 'session')} · {plural(live.previews, 'preview')} · {live.hearts} approved · {plural(live.purchases, 'mock purchase')}. Deleted sessions are removed from these counts.</p>
      </div>
      <p className="mt-6"><Link className="underline" href="/">Back to GiftFit</Link></p>
    </>
  );
}
