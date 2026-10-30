'use client';
import Link from 'next/link';
import { useState } from 'react';
import { btn, errorText, h1, pill } from './ui';

type Props = { sessionId: string; itemId: string; name: string; price: number; renderId: string; recipient: string };

export default function Checkout({ sessionId, itemId, name, price, renderId, recipient }: Props) {
  const [order, setOrder] = useState<{ orderId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function place() {
    setBusy(true); setErr(false);
    const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, itemId }) });
    setBusy(false);
    if (r.ok) setOrder(await r.json()); else setErr(true);
  }

  if (order) return (
    <>
      <p className={pill} role="status">Demo order placed</p>
      <h1 className={h1}>It’s on its way to {recipient}</h1>
      <p className="text-muted">Order {order.orderId}: {name}, ${price}. No payment was taken and nothing was ordered. This is a demo checkout.</p>
      <p><Link className={btn} href={`/gift/${sessionId}`}>Back to the board</Link></p>
    </>
  );
  return (
    <>
      <h1 className={h1}>Your choice</h1>
      <div className="overflow-hidden rounded-2xl border-[1.5px] border-tissue">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="aspect-[4/5] w-full object-cover" src={`/api/renders/${renderId}/image`} alt={`Preview of ${name}`} />
        <div className="flex items-baseline justify-between gap-3 p-4"><b>{name}</b><span className="font-semibold">${price}</span></div>
      </div>
      <p className="mt-4 text-sm text-muted">Demo checkout: no payment, address or personal details are collected, and nothing is shipped. The preview shows style, not an exact fit.</p>
      {err && <p role="alert" className={`${errorText} mt-3`}>Could not place the demo order. Try again.</p>}
      <p className="mt-5 flex flex-wrap gap-3"><button className={btn} onClick={place} disabled={busy}>{busy ? 'Placing…' : 'Place demo order'}</button>
        <Link className="self-center underline" href={`/gift/${sessionId}`}>Back</Link></p>
    </>
  );
}
