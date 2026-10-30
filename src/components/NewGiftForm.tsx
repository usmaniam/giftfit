'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btn, field, label, card, errorText } from './ui';

export default function NewGiftForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const body = {
      giverName: String(f.get('giverName')), recipientFirstName: String(f.get('recipientFirstName')),
      occasion: String(f.get('occasion')), mode: String(f.get('mode')),
      budgetMin: Number(f.get('budgetMin')), budgetMax: Number(f.get('budgetMax')),
    };
    setBusy(true);
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(json.issues?.fieldErrors ? 'Check the form: names are required and the minimum budget cannot exceed the maximum.' : 'Could not create the gift. Try again.');
      return;
    }
    try { localStorage.setItem(`giftfit:invite:${json.id}`, json.inviteUrl); } catch { /* storage blocked */ }
    router.push(`/gift/${json.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 grid gap-4">
      <label className={label}>Your first name<input className={field} name="giverName" required maxLength={40} autoComplete="given-name" /></label>
      <label className={label}>Who is it for? (first name)<input className={field} name="recipientFirstName" required maxLength={40} /></label>
      <label className={label}>Occasion
        <select className={field} name="occasion" defaultValue="birthday">
          <option value="birthday">Birthday</option><option value="holiday">Holiday</option>
          <option value="anniversary">Anniversary</option><option value="thank-you">Thank you</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>Budget from ($)<input className={field} name="budgetMin" type="number" inputMode="numeric" min={0} defaultValue={25} required /></label>
        <label className={label}>to ($)<input className={field} name="budgetMax" type="number" inputMode="numeric" min={1} defaultValue={100} required /></label>
      </div>
      <fieldset className={card}>
        <legend className="px-1 font-semibold">How should it work?</legend>
        <label className="flex items-start gap-3"><input className="mt-1.5" type="radio" name="mode" value="surprise" defaultChecked />
          <span><b>Surprise</b>: they never see which items were previewed.</span></label>
        <label className="flex items-start gap-3"><input className="mt-1.5" type="radio" name="mode" value="copick" />
          <span><b>Co-pick</b>: they react to previews, and you only see the ones they approve.</span></label>
      </fieldset>
      {error && <p role="alert" className={errorText}>{error}</p>}
      <button className={btn} disabled={busy}>{busy ? 'Creating…' : 'Create invite link'}</button>
    </form>
  );
}
