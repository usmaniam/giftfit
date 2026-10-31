'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { btn, btnGhost, errorText } from './ui';

type Pick = { itemId: string; name: string; category: string; price: number; rank: number; reason: string; caveat: string; source: 'llm' | 'rules'; kind: 'scene' | 'overlay' };
type Render = { id: string; itemId: string; status: 'queued' | 'running' | 'success' | 'error'; errorCode: string | null };
type Props = { sessionId: string; name: string; mode: 'surprise' | 'copick'; status: string };

const BADGE = { scene: 'Style preview, not an exact fit', overlay: 'Preview only, fit can differ' } as const;

export default function Board({ sessionId, name, mode, status }: Props) {
  const router = useRouter();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [renders, setRenders] = useState<Render[]>([]);
  const [demo, setDemo] = useState(false);
  const [proposed, setProposed] = useState<number | null>(null);
  const [serverStarted, setServerStarted] = useState(false);
  const [awaiting, setAwaiting] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refresh = useCallback(async () => {
    const [p, r] = await Promise.all([fetch(`/api/agent/shortlist?sessionId=${sessionId}`), fetch(`/api/renders?sessionId=${sessionId}`)]);
    if (p.ok) { const j = await p.json(); setPicks(j.picks); setServerStarted(j.started); setAwaiting(j.awaitingReview); }
    if (r.ok) { const j = await r.json(); setRenders(j.renders); setDemo(j.demo); return j.renders as Render[]; }
    return [];
  }, [sessionId]);

  // Poll every 2s while anything is queued or running. The list call itself advances the queue server-side.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const rs = await refresh();
      if (alive && rs.some((x) => x.status === 'queued' || x.status === 'running')) timer.current = setTimeout(tick, 2000);
    };
    tick();
    return () => { alive = false; clearTimeout(timer.current); };
  }, [refresh, status]);

  // Co-pick: approvals arrive from the recipient at any time, so keep checking.
  useEffect(() => {
    if (mode !== 'copick') return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [mode, refresh]);

  async function start() {
    setBusy(true); setErr(null);
    const r = await fetch('/api/agent/shortlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, render: true }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error === 'recipient_not_ready' ? `${name} hasn’t finished setup yet.` : 'Could not find gift ideas. Try again.');
    if (j.renders?.error === 'share_consent_required') setErr(`${name} chose not to share previews with you.`);
    setProposed(j.proposed);
    const rs = await refresh();
    if (rs.some((x) => x.status === 'queued' || x.status === 'running')) {
      clearTimeout(timer.current);
      const loop = async () => { const x = await refresh(); if (x.some((y) => y.status === 'queued' || y.status === 'running')) timer.current = setTimeout(loop, 2000); };
      timer.current = setTimeout(loop, 2000);
    }
  }

  const cards = picks.map((k) => ({ k, r: renders.find((x) => x.itemId === k.itemId) }));
  const llm = picks.filter((k) => k.source === 'llm').length;
  const started = serverStarted || renders.length > 0 || picks.length > 0 || proposed !== null;

  return (
    <section aria-label="Gift board">
      {demo && <p className="mb-4 rounded-2xl bg-tissue p-3 text-sm">Demo mode: previews are labeled placeholders, not real YouCam renders. {name} is an AI-generated sample.</p>}
      {mode === 'surprise'
        ? <p className="text-sm text-muted">Only you see these. {name} never learns which items were previewed.</p>
        : <p className="text-sm text-muted">Co-pick: you’ll only see previews {name} approves.</p>}

      {!started && (
        <div className="mt-5">
          <button className={btn} onClick={start} disabled={busy}>{busy ? 'Finding ideas…' : 'Show me gift ideas'}</button>
        </div>
      )}
      {err && <p role="alert" className={`${errorText} mt-3`}>{err}</p>}
      {started && mode === 'copick' && cards.length === 0 && (
        <p className="mt-5" role="status">{awaiting > 0 ? `${name} is reviewing ${awaiting} preview${awaiting === 1 ? '' : 's'}. Approved ones will appear here.` : `${name} didn’t approve any of these this time.`}</p>
      )}
      {started && mode === 'copick' && cards.length > 0 && awaiting > 0 && <p className="mt-5 text-sm text-muted" role="status">{awaiting} more still with {name} for review.</p>}
      {started && mode === 'surprise' && proposed === 0 && <p className="mt-5" role="status">No items matched {name}’s limits and your budget. Try a wider budget.</p>}

      <ul className="mt-5 grid list-none gap-6 p-0">
        {cards.map(({ k, r }) => (
          <li key={k.itemId} className="overflow-hidden rounded-2xl border-[1.5px] border-tissue">
            <div className="relative aspect-[4/5] bg-tissue">
              {r?.status === 'success' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="h-full w-full object-cover" src={`/api/renders/${r.id}/image`} alt={`Preview of ${k.name}`} loading="lazy" />
              ) : (
                <div className="grid h-full place-items-center p-6 text-center motion-safe:animate-pulse" role="status">
                  {r?.status === 'error' ? 'This preview couldn’t be generated.' : r?.status === 'running' ? 'Rendering…' : 'Waiting in line…'}
                </div>
              )}
              <span className="absolute top-3 left-3 rounded-full bg-paper/90 px-3 py-1 text-xs font-semibold text-ink">{BADGE[k.kind]}</span>
            </div>
            <div className="grid gap-2 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display m-0 text-xl leading-tight">{k.name}</h2>
                <span className="font-semibold">${k.price}</span>
              </div>
              <p className="m-0"><b>Why this:</b> {k.reason}</p>
              {k.caveat.replace(/\.$/, '') !== BADGE[k.kind] && <p className="m-0 text-sm text-muted">{k.caveat}</p>}
              {r?.status === 'success' && <button className={`${btn} mt-1 w-full`} onClick={() => router.push(`/gift/${sessionId}/checkout?item=${k.itemId}`)}>Choose this gift</button>}
            </div>
          </li>
        ))}
      </ul>

      {picks.length > 0 && (
        <details className="mt-8 rounded-2xl border-[1.5px] border-tissue p-4">
          <summary className="cursor-pointer font-semibold">How these were picked</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px]">
            <li>Everything in the catalog was checked against {name}’s own limits on our server. Those limits aren’t shown to you.</li>
            <li>What remained was scored on occasion fit and how close the price sits to your budget, with at most two per category.</li>
            <li>{llm > 0 ? `An AI model (Gemini) wrote ${llm} of the reasons. It received only the occasion, your budget range and product details: no photos, names or notes.` : 'The reasons were generated by rules. No AI model was used for this shortlist.'}</li>
            <li>Every preview is labeled. Scenes show style, not size or fit.</li>
          </ol>
        </details>
      )}
      {started && picks.length > 0 && <p className="mt-4"><button className={btnGhost} onClick={() => router.refresh()}>Refresh</button></p>}
    </section>
  );
}
