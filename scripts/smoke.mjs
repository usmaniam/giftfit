// End-to-end smoke test against a running server in DEMO_MODE:  pnpm dev  (or start)  then  pnpm test:smoke
// BASE_URL defaults to http://localhost:3000. Exits non-zero on any failure.
import { readFile } from 'node:fs/promises';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const sample = await readFile(new URL('../scripts/test-selfie.png', import.meta.url));
let failures = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failures++; };
const req = (path, method = 'GET', body) => fetch(BASE + path, { method, ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
const json = async (path, method, body) => { const r = await req(path, method, body); return { status: r.status, body: await r.json().catch(() => null) }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const upload = (token, kind, bytes = sample, name = 's.png', type = 'image/png') => {
  const f = new FormData(); f.set('kind', kind); f.set('file', new Blob([bytes], { type }), name);
  return fetch(`${BASE}/api/invite/${token}/upload`, { method: 'POST', body: f });
};
const CATS = ['scarf', 'earrings', 'necklace', 'bag', 'top', 'hat', 'look'];

async function newSession(mode) {
  const s = await json('/api/sessions', 'POST', { giverName: 'Sam', recipientFirstName: 'Alex', occasion: 'birthday', budgetMin: 25, budgetMax: 150, mode });
  const token = s.body.inviteUrl.split('/').pop();
  await json(`/api/invite/${token}`, 'PUT', { consentRender: true, consentShareRenders: true, deleteAfterDays: 7 });
  await upload(token, 'selfie');
  await json(`/api/invite/${token}`, 'PUT', { allowedCategories: CATS, metalPref: 'any', avoidColors: [] });
  await json(`/api/invite/${token}/complete`, 'POST');
  return { id: s.body.id, token };
}
// Starts the agent + renders, then waits until every accepted render is finished.
// `ready()` counts finished renders from the point of view that can see them (giver in surprise mode, recipient in co-pick).
async function renderAll(id, ready) {
  const run = await json('/api/agent/shortlist', 'POST', { sessionId: id, count: 4, render: true });
  const want = run.body.renders?.accepted?.length ?? 0;
  for (let i = 0; i < 30 && want; i++) {
    await json(`/api/renders?sessionId=${id}`); // listing advances the render queue server-side
    if ((await ready()) >= want) break;
    await sleep(1000);
  }
  return run.body;
}

const health = await json('/api/health');
check('health', health.status === 200 && health.body.catalogItems >= 12, `catalog=${health.body?.catalogItems}`);
if (!health.body?.demoMode) { console.log('Server is not in DEMO_MODE; stopping (this smoke test is for demo mode).'); process.exit(2); }

check('rejects min budget above max', (await json('/api/sessions', 'POST', { giverName: 'a', recipientFirstName: 'b', occasion: 'birthday', budgetMin: 200, budgetMax: 100, mode: 'surprise' })).status === 400);
const pre = await json('/api/sessions', 'POST', { giverName: 'Sam', recipientFirstName: 'Alex', occasion: 'birthday', budgetMin: 25, budgetMax: 150, mode: 'surprise' });
const preTok = pre.body.inviteUrl.split('/').pop();
check('upload blocked before consent', (await upload(preTok, 'selfie')).status === 403);
check('agent blocked before recipient is ready', (await json('/api/agent/shortlist', 'POST', { sessionId: pre.body.id })).status === 409);

// Surprise flow
const a = await newSession('surprise');
check('recipient setup completes -> ready', (await json(`/api/sessions/${a.id}`)).body.status === 'ready');
check('rejects non-image upload', (await upload(a.token, 'hand', Buffer.from('not an image'), 'x.jpg', 'image/jpeg')).status === 415);
const run = await renderAll(a.id, async () => ((await json(`/api/renders?sessionId=${a.id}`)).body.renders ?? []).filter((r) => r.status === 'success').length);
check('agent proposes picks', run.proposed > 0, `proposed=${run.proposed}`);
const list = await json(`/api/renders?sessionId=${a.id}`);
const done = (list.body.renders ?? []).filter((r) => r.status === 'success');
check('previews rendered and visible to giver', done.length > 0, `${done.length} ready`);
const img = await req(`/api/renders/${done[0]?.id}/image`);
check('preview image served', img.status === 200 && (img.headers.get('content-type') ?? '').startsWith('image/'));
check('recipient cannot see previews in surprise mode', (await json(`/api/invite/${a.token}/renders`)).body.items.length === 0);
const buy = await json('/api/checkout', 'POST', { sessionId: a.id, itemId: done[0]?.itemId });
check('mock checkout', buy.status === 201 && /^GF-/.test(buy.body?.orderId ?? ''), buy.body?.orderId);

// Co-pick flow
const c = await newSession('copick');
await renderAll(c.id, async () => (await json(`/api/invite/${c.token}/renders`)).body.items.length);
check('co-pick: giver sees nothing before approval', (await json(`/api/agent/shortlist?sessionId=${c.id}`)).body.picks.length === 0);
const review = (await json(`/api/invite/${c.token}/renders`)).body.items;
check('co-pick: recipient can review previews', review.length > 0, `${review.length} items`);
await json(`/api/invite/${c.token}/react`, 'POST', { itemId: review[0].itemId, reaction: 'heart' });
if (review[1]) await json(`/api/invite/${c.token}/react`, 'POST', { itemId: review[1].itemId, reaction: 'veto' });
const seen = (await json(`/api/agent/shortlist?sessionId=${c.id}`)).body.picks.map((p) => p.itemId);
check('co-pick: giver sees only the hearted item', seen.length === 1 && seen[0] === review[0].itemId);
if (review[1]) check('co-pick: vetoed item cannot be bought', (await json('/api/checkout', 'POST', { sessionId: c.id, itemId: review[1].itemId })).status === 404);

// Privacy
check('recipient delete-all', (await json('/api/me/delete', 'POST', { token: a.token })).status === 200);
check('giver session gone after delete', (await json(`/api/sessions/${a.id}`)).status === 404);
check('invite link dead after delete', (await req(`/api/invite/${a.token}`)).status === 404);
check('preview gone after delete', (await req(`/api/renders/${done[0]?.id}/image`)).status === 404);

const m = await (await req('/merchant')).text();
check('merchant page labeled as demo data', m.includes('Demo data. Seeded for illustration'));
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
