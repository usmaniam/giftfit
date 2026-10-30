'use client';
import { useEffect, useState } from 'react';
import Board from './Board';
import { btn, field, h1, pill } from './ui';

type S = { id: string; recipientFirstName: string; occasion: string; budgetMin: number; budgetMax: number; mode: 'surprise' | 'copick'; status: string; expiresAt: string };
const LABEL: Record<string, string> = { created: 'Setting up', invited: 'Waiting for', ready: 'Ready:', rendering: 'Previewing for', done: 'Previews ready for' };

export function Ended({ name }: { name: string }) {
  return (<><h1 className={h1}>This gift session has ended</h1>
    <p className="text-muted">{name} deleted their data, so the previews are gone and this link no longer works. Start a new gift any time.</p></>);
}

export default function GiftStatus({ initial }: { initial: S }) {
  const [s, setS] = useState(initial);
  const [ended, setEnded] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { setInvite(localStorage.getItem(`giftfit:invite:${s.id}`)); } catch { /* storage blocked */ }
    const t = setInterval(async () => {
      const r = await fetch(`/api/sessions/${s.id}`);
      if (r.status === 404) setEnded(true); else if (r.ok) setS(await r.json());
    }, 5000);
    return () => clearInterval(t);
  }, [s.id]);

  async function share() {
    if (!invite) return;
    if (navigator.share) { try { await navigator.share({ title: 'A gift preview for you', url: invite }); return; } catch { return; } }
    await navigator.clipboard.writeText(invite); setCopied(true);
  }
  if (ended) return <Ended name={s.recipientFirstName} />;

  return (
    <>
      <p className={pill} role="status">{LABEL[s.status] ?? s.status} {s.recipientFirstName}</p>
      <h1 className={h1}>A {s.occasion.replace('-', ' ')} gift for {s.recipientFirstName}</h1>
      <p className="text-muted">${s.budgetMin}–${s.budgetMax} · {s.mode === 'surprise' ? 'Surprise mode' : 'Co-pick mode'}</p>
      <div className="my-6 h-2.5 rounded-full bg-ribbon" aria-hidden />
      {s.status === 'invited' || s.status === 'created' ? (invite ? (
        <>
          <p>Send {s.recipientFirstName} this private link. It expires {new Date(s.expiresAt).toLocaleDateString()}.</p>
          <input className={field} readOnly value={invite} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
          <p><button className={btn} onClick={share}>{copied ? 'Copied' : 'Share or copy link'}</button></p>
        </>
      ) : (
        <p className="text-muted">The invite link is shown only on the device that created this gift. Start a new gift to get a fresh link.</p>
      )) : <Board sessionId={s.id} name={s.recipientFirstName} mode={s.mode} status={s.status} />}
    </>
  );
}
