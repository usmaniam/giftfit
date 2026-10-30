'use client';
import { useCallback, useEffect, useState } from 'react';

type Item = { renderId: string; itemId: string; name: string; category: string; price: number; kind: 'scene' | 'overlay'; reaction: 'heart' | 'veto' | null };
const BADGE = { scene: 'Style preview, not an exact fit', overlay: 'Preview only, fit can differ' } as const;

export default function ReviewPanel({ token, giver }: { token: string; giver: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/invite/${token}/renders`);
    if (r.ok) setItems((await r.json()).items);
  }, [token]);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  async function react(it: Item, reaction: 'heart' | 'veto') {
    const next = it.reaction === reaction ? null : reaction; // tapping again undoes it
    setErr(false);
    setItems((xs) => xs && xs.map((x) => (x.itemId === it.itemId ? { ...x, reaction: next } : x)));
    const r = await fetch(`/api/invite/${token}/react`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemId: it.itemId, reaction: next }) });
    if (!r.ok) { setErr(true); load(); }
  }

  if (items === null) return null;
  return (
    <section className="mt-8" aria-label="Previews to review">
      <h2 className="font-display mb-2 text-2xl">Previews for you to review</h2>
      <p className="text-muted">{giver} will only see the ones you heart. Anything else stays private, and you can change your mind.</p>
      {items.length === 0 && <p role="status">Nothing to review yet. This page updates when {giver} picks some ideas.</p>}
      {err && <p role="alert" className="font-semibold text-ribbon">Could not save that. Try again.</p>}
      <ul className="grid list-none gap-6 p-0">
        {items.map((it) => (
          <li key={it.itemId} className="overflow-hidden rounded-2xl border-[1.5px] border-tissue">
            <div className="relative aspect-[4/5] bg-tissue">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="h-full w-full object-cover" src={`/api/invite/${token}/render/${it.renderId}/image`} alt={`Preview of ${it.name} on you`} loading="lazy" />
              <span className="absolute top-3 left-3 rounded-full bg-paper/90 px-3 py-1 text-xs font-semibold text-ink">{BADGE[it.kind]}</span>
            </div>
            <div className="grid gap-3 p-4">
              <div className="flex items-baseline justify-between gap-3"><h3 className="font-display m-0 text-xl">{it.name}</h3><span className="font-semibold">${it.price}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <button aria-pressed={it.reaction === 'heart'} onClick={() => react(it, 'heart')}
                  className={`cursor-pointer rounded-2xl border-[1.5px] px-4 py-3 font-semibold focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink ${it.reaction === 'heart' ? 'border-ribbon bg-ribbon text-white' : 'border-muted'}`}>♥ Love it</button>
                <button aria-pressed={it.reaction === 'veto'} onClick={() => react(it, 'veto')}
                  className={`cursor-pointer rounded-2xl border-[1.5px] px-4 py-3 font-semibold focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink ${it.reaction === 'veto' ? 'border-ink bg-ink text-paper' : 'border-muted'}`}>✕ Not for me</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
