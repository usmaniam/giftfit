'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnGhost } from './ui';

export default function DemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  async function go() {
    setBusy(true); setErr(false);
    const r = await fetch('/api/demo/start', { method: 'POST' });
    if (!r.ok) { setBusy(false); setErr(true); return; }
    router.push(`/gift/${(await r.json()).id}`);
  }
  return (
    <>
      <button className={btnGhost} onClick={go} disabled={busy}>{busy ? 'Setting up…' : 'Try the demo (illustrated sample recipient)'}</button>
      {err && <p role="alert" className="mt-2 font-semibold text-ribbon">Could not start the demo. Try again.</p>}
    </>
  );
}
