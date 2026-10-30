'use client';
import { useEffect, useState } from 'react';
import { btn, btnGhost, card, errorText, field, h1, label, pill } from './ui';
import { CATEGORIES, COLORS, DELETE_AFTER_DAYS, NEEDS_HAND } from '@/lib/constants';
import ReviewPanel from './ReviewPanel';

type Profile = {
  consentRender: boolean; consentShareRenders: boolean; deleteAfterDays: number; hasSelfie: boolean; hasHand: boolean;
  photosDeleteAt?: string | null; allowedCategories: string[]; metalPref: 'gold' | 'silver' | 'any'; avoidColors: string[]; noGoText: string; shareColorProfile: boolean;
};
type Info = { giverName: string; recipientFirstName: string; occasion: string; mode: 'surprise' | 'copick'; status: string };
const STEPS = ['Welcome', 'Consent', 'Photos', 'Boundaries', 'Sharing'];

/** Re-encodes in the browser: bakes in orientation, strips EXIF/GPS, caps size. */
async function prepare(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.9));
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`cursor-pointer rounded-full border-[1.5px] px-4 py-2 text-[15px] font-semibold capitalize focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink ${on ? 'border-ribbon bg-ribbon text-white' : 'border-muted'}`}>
      {children}
    </button>
  );
}
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function RecipientFlow({ token }: { token: string }) {
  const api = `/api/invite/${token}`;
  const [info, setInfo] = useState<Info | null>(null);
  const [p, setP] = useState<Profile | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<'ready' | 'deleted' | null>(null);
  const [receipt, setReceipt] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [bust, setBust] = useState(0);

  useEffect(() => {
    fetch(api).then((r) => r.json()).then((j) => { setInfo(j.session); setP(j.profile); if (['ready', 'rendering', 'done'].includes(j.session.status)) setDone('ready'); });
  }, [api]);

  if (!info || !p) return <p className="text-muted" role="status">Loading…</p>;
  const set = (patch: Partial<Profile>) => setP({ ...p, ...patch });

  async function save(patch: Partial<Profile>): Promise<boolean> {
    setErr(null);
    const r = await fetch(api, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
    if (!r.ok) { setErr('Could not save. Please try again.'); return false; }
    return true;
  }
  async function next(patch: Partial<Profile>) {
    setBusy(true);
    if (await save(patch)) setStep((s) => s + 1);
    setBusy(false);
  }
  async function upload(kind: 'selfie' | 'hand', file?: File) {
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const form = new FormData();
      form.set('kind', kind); form.set('file', await prepare(file), `${kind}.jpg`);
      const r = await fetch(`${api}/upload`, { method: 'POST', body: form });
      const j = await r.json();
      if (!r.ok) setErr(j.hint ?? 'That photo could not be used.');
      else { set(kind === 'selfie' ? { hasSelfie: true, photosDeleteAt: new Date(Date.now() + p!.deleteAfterDays * 86_400_000).toISOString() } : { hasHand: true }); setBust(Date.now()); }
    } catch { setErr('Could not read that photo. Try a JPEG or PNG.'); }
    setBusy(false);
  }
  async function finish() {
    setBusy(true);
    if (await save({ shareColorProfile: p!.shareColorProfile })) {
      const r = await fetch(`${api}/complete`, { method: 'POST' });
      if (r.ok) setDone('ready'); else setErr('Almost there: add a selfie and at least one category.');
    }
    setBusy(false);
  }
  async function deleteAll() {
    setBusy(true);
    const r = await fetch('/api/me/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
    setBusy(false);
    if (r.ok) { setReceipt(new Date().toLocaleString()); setDone('deleted'); } else setErr('Could not delete. Please try again.');
  }

  const deleteBlock = (
    <div className="mt-10 border-t-[1.5px] border-tissue pt-5">
      {p.photosDeleteAt && <p className="mt-0 mb-3 text-[15px] text-muted" role="status">Your photos delete automatically on {new Date(p.photosDeleteAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} ({Math.max(0, Math.ceil((new Date(p.photosDeleteAt).getTime() - Date.now()) / 86_400_000))} days left).</p>}
      {confirmDel ? (
        <div className="grid gap-3">
          <p className="m-0 font-semibold">Delete your photos and preferences and deactivate this link?</p>
          <div className="flex gap-3"><button className={btn} onClick={deleteAll} disabled={busy}>Yes, delete everything</button>
            <button className={btnGhost} onClick={() => setConfirmDel(false)}>Cancel</button></div>
        </div>
      ) : <button className="cursor-pointer text-[15px] underline" onClick={() => setConfirmDel(true)}>Delete my data now</button>}
    </div>
  );

  if (done === 'deleted') return (<><h1 className={h1}>All deleted</h1><p className="text-muted">Your photos and preferences are gone and this link no longer works.</p>
    <div className={card} role="status"><b>Deletion receipt</b><span className="text-[15px]">{receipt}</span>
      <span className="text-[15px] text-muted">Removed: selfie and hand photo, any previews, gift picks, your preferences and notes. The giver has been told the session ended.</span></div></>);
  if (done === 'ready') return (
    <>
      <h1 className={h1}>You’re all set, {info.recipientFirstName}</h1>
      <p className="text-muted">{info.giverName} can now preview ideas on you, inside your boundaries.{' '}
        {info.mode === 'surprise' ? 'You won’t see which items were previewed, so the surprise stays intact.' : `You’ll get to heart or veto the previews before ${info.giverName} sees them.`}</p>
      {info.mode === 'copick' && <ReviewPanel token={token} giver={info.giverName} />}
      {deleteBlock}
    </>
  );

  const needsHand = p.allowedCategories.some((c) => (NEEDS_HAND as readonly string[]).includes(c));
  return (
    <>
      <p className={pill} role="status">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

      {step === 0 && (<>
        <h1 className={h1}>{info.giverName} would like to preview a {info.occasion} gift on you</h1>
        <p className="text-muted">You share one selfie and set your limits. The giver sees style previews of real products on you, never your original photo. You can delete everything at any time.</p>
        <ul className="my-4 list-disc space-y-1 pl-5">
          <li>You choose which kinds of gifts are allowed.</li>
          <li>Your photos are deleted after the time you pick.</li>
          <li>Previews show style, not exact fit.</li>
        </ul>
        <button className={btn} onClick={() => setStep(1)}>Get started</button>
      </>)}

      {step === 1 && (<>
        <h1 className={h1}>Your consent</h1>
        <div className="grid gap-3">
          <label className="flex items-start gap-3"><input className="mt-1.5" type="checkbox" checked={p.consentRender} onChange={(e) => set({ consentRender: e.target.checked })} />
            <span>I agree to use my photo to render gift previews with YouCam’s virtual try-on service. <b>Required.</b></span></label>
          <label className="flex items-start gap-3"><input className="mt-1.5" type="checkbox" checked={p.consentShareRenders} onChange={(e) => set({ consentShareRenders: e.target.checked })} />
            <span>Let {info.giverName} see the rendered previews{info.mode === 'copick' ? ' I approve' : ''}.</span></label>
          <label className={label}>Delete my photos after
            <select className={field} value={p.deleteAfterDays} onChange={(e) => set({ deleteAfterDays: Number(e.target.value) })}>
              {DELETE_AFTER_DAYS.map((d) => <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>)}
            </select></label>
          <p className="m-0 text-[15px] text-muted">Gift ideas are picked with an AI model that only receives non-identifying settings (categories, metals, colors, budget), never your photo, name, or notes.</p>
        </div>
        {err && <p role="alert" className={`${errorText} mt-3`}>{err}</p>}
        <div className="mt-5 flex gap-3"><button className={btnGhost} onClick={() => setStep(0)}>Back</button>
          <button className={btn} disabled={!p.consentRender || busy} onClick={() => next({ consentRender: p.consentRender, consentShareRenders: p.consentShareRenders, deleteAfterDays: p.deleteAfterDays })}>Continue</button></div>
      </>)}

      {step === 2 && (<>
        <h1 className={h1}>Your photos</h1>
        <div className={card}>
          <b>Selfie</b>
          <p className="m-0 text-[15px] text-muted">Face visible, head to chest, even light, at least 512×512.</p>
          {p.hasSelfie && <img className="h-40 w-40 rounded-2xl object-cover" alt="Your uploaded selfie" src={`${api}/asset/selfie?v=${bust}`} />}
          <input className={field} type="file" accept="image/jpeg,image/png,image/*" capture="user" aria-label="Upload selfie" onChange={(e) => upload('selfie', e.target.files?.[0])} />
        </div>
        <div className={`${card} mt-3`}>
          <b>Hand photo (optional)</b>
          <p className="m-0 text-[15px] text-muted">Back of your hand, five fingers visible. Only needed for rings and watches.</p>
          {p.hasHand && <img className="h-40 w-40 rounded-2xl object-cover" alt="Your uploaded hand photo" src={`${api}/asset/hand?v=${bust}`} />}
          <input className={field} type="file" accept="image/jpeg,image/png,image/*" aria-label="Upload hand photo" onChange={(e) => upload('hand', e.target.files?.[0])} />
        </div>
        {busy && <p role="status" className="text-muted">Uploading…</p>}
        {err && <p role="alert" className={`${errorText} mt-3`}>{err}</p>}
        <div className="mt-5 flex gap-3"><button className={btnGhost} onClick={() => setStep(1)}>Back</button>
          <button className={btn} disabled={!p.hasSelfie || busy} onClick={() => setStep(3)}>Continue</button></div>
      </>)}

      {step === 3 && (<>
        <h1 className={h1}>Your boundaries</h1>
        <fieldset className={card}><legend className="px-1 font-semibold">Gift types that are okay</legend>
          <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <Chip key={c} on={p.allowedCategories.includes(c)} onClick={() => set({ allowedCategories: toggle(p.allowedCategories, c) })}>{c}</Chip>)}</div>
          {needsHand && !p.hasHand && <p className="m-0 text-[15px] text-muted">Rings and watches need a hand photo, or they’ll be skipped.</p>}
        </fieldset>
        <fieldset className={`${card} mt-3`}><legend className="px-1 font-semibold">Jewelry metal</legend>
          <div className="flex flex-wrap gap-2">{(['gold', 'silver', 'any'] as const).map((m) => <Chip key={m} on={p.metalPref === m} onClick={() => set({ metalPref: m })}>{m === 'any' ? 'Either' : m}</Chip>)}</div>
        </fieldset>
        <fieldset className={`${card} mt-3`}><legend className="px-1 font-semibold">Colors to avoid</legend>
          <div className="flex flex-wrap gap-2">{COLORS.map((c) => <Chip key={c} on={p.avoidColors.includes(c)} onClick={() => set({ avoidColors: toggle(p.avoidColors, c) })}>{c}</Chip>)}</div>
        </fieldset>
        <label className={`${label} mt-3`}>Anything else that’s a no? (private to you)
          <textarea className={field} rows={3} maxLength={300} value={p.noGoText} onChange={(e) => set({ noGoText: e.target.value })} /></label>
        {err && <p role="alert" className={`${errorText} mt-3`}>{err}</p>}
        <div className="mt-5 flex gap-3"><button className={btnGhost} onClick={() => setStep(2)}>Back</button>
          <button className={btn} disabled={p.allowedCategories.length === 0 || busy}
            onClick={() => next({ allowedCategories: p.allowedCategories, metalPref: p.metalPref, avoidColors: p.avoidColors, noGoText: p.noGoText })}>Continue</button></div>
        {p.allowedCategories.length === 0 && <p className="mt-2 text-[15px] text-muted">Pick at least one gift type to continue.</p>}
      </>)}

      {step === 4 && (<>
        <h1 className={h1}>What to share</h1>
        <label className="flex items-start gap-3"><input className="mt-1.5" type="checkbox" checked={p.shareColorProfile} onChange={(e) => set({ shareColorProfile: e.target.checked })} />
          <span>Share my color profile (undertone) so gift picks can match flattering metals and colors. <b>Off by default.</b></span></label>
        {err && <p role="alert" className={`${errorText} mt-3`}>{err}</p>}
        <div className="mt-5 flex gap-3"><button className={btnGhost} onClick={() => setStep(3)}>Back</button>
          <button className={btn} disabled={busy} onClick={finish}>Finish</button></div>
      </>)}
      {deleteBlock}
    </>
  );
}
