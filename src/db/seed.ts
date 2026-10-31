import { db, schema, client } from './index';
import { eq } from 'drizzle-orm';
import { ensureBucket } from '../lib/storage';

type Item = typeof schema.catalogItems.$inferInsert;
const M = 'merchant-demo';
// Generic, unbranded placeholder products. Images are SVG placeholders until
// real licensed photos are vetted against each endpoint's spec (see ASSETS_LICENSES.md).
const item = (id: string, name: string, category: Item['category'], price: number, colors: string[], tags: string[], metal?: 'gold' | 'silver'): Item => ({
  id, name, category, price, currency: 'USD', brand: 'Atelier Demo', imageUrl: `/catalog/${id}.svg`,
  imageSpecOk: false, metal: metal ?? null, colors, tags, merchantId: M,
});

export const CATALOG: Item[] = [
  item('scarf-silk-sage', 'Silk twill scarf, sage', 'scarf', 48, ['green'], ['birthday', 'holiday', 'thank-you']),
  item('scarf-wool-rust', 'Merino wool scarf, rust', 'scarf', 62, ['orange', 'brown'], ['holiday', 'birthday']),
  item('hat-beanie-oat', 'Ribbed beanie, oat', 'hat', 28, ['beige'], ['holiday', 'birthday']),
  item('bag-tote-black', 'Leather tote, black', 'bag', 140, ['black'], ['anniversary', 'birthday']),
  item('bag-crossbody-tan', 'Crossbody bag, tan', 'bag', 95, ['brown', 'beige'], ['birthday', 'holiday']),
  item('earrings-hoop-gold', 'Small hoop earrings, gold', 'earrings', 54, ['gold'], ['anniversary', 'birthday', 'holiday'], 'gold'),
  item('earrings-stud-silver', 'Pearl drop earrings, silver', 'earrings', 46, ['silver', 'white'], ['anniversary', 'thank-you'], 'silver'),
  item('necklace-pendant-gold', 'Pendant necklace, gold', 'necklace', 78, ['gold'], ['anniversary', 'birthday'], 'gold'),
  item('necklace-chain-silver', 'Fine chain necklace, silver', 'necklace', 64, ['silver'], ['birthday', 'holiday', 'thank-you'], 'silver'),
  item('top-knit-cream', 'Soft knit top, cream', 'top', 70, ['white', 'beige'], ['holiday', 'birthday']),
  item('ring-band-gold', 'Slim band ring, gold', 'ring', 88, ['gold'], ['anniversary'], 'gold'),
  item('look-soft-glam', 'Soft glam makeup look', 'look', 0, ['pink'], ['birthday', 'holiday']),
];

// Idempotent: upsert by id, safe to run on every boot (re-run after deploys).
async function seedCatalog() {
  for (const row of CATALOG) {
    const { id: _id, ...fields } = row;
    await db.insert(schema.catalogItems).values(row).onConflictDoUpdate({ target: schema.catalogItems.id, set: fields });
  }
  console.log(`Seeded ${CATALOG.length} catalog items.`);
}

// ---- Seeded merchant demo data (clearly labeled in the UI; replaced on every run) ----
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const HEART_RATE: Record<string, number> = { scarf: 0.62, earrings: 0.55, necklace: 0.5, top: 0.42, look: 0.45, bag: 0.38, hat: 0.35, ring: 0.3, watch: 0.25 };
async function seedDemoEvents() {
  const r = rng(2026), now = Date.now();
  const acc: Record<string, number> = {}; // per-category error diffusion keeps realized approval close to each target rate
  type Ev = typeof schema.merchantEvents.$inferInsert;
  const events: Ev[] = [];
  let n = 0;
  const ev = (sid: string, itemId: string, type: Ev['type'], ts: number): Ev => ({ id: `seed-${++n}`, merchantId: M, sessionId: sid, itemId, type, ts: new Date(ts), seeded: true });
  for (let i = 1; i <= 48; i++) {
    const sid = `demo-s-${String(i).padStart(3, '0')}`;
    const t0 = now - Math.floor(r() * 29) * 86_400_000 - Math.floor(r() * 80_000_000);
    const copick = r() < 0.6;
    const pool = CATALOG.filter((c) => c.category !== 'watch').sort(() => r() - 0.5).slice(0, 4 + Math.floor(r() * 3));
    const hearted: string[] = [];
    pool.forEach((c, k) => {
      events.push(ev(sid, c.id, 'preview', t0 + k * 4000));
      if (copick) { acc[c.category] = (acc[c.category] ?? r()) + (HEART_RATE[c.category] ?? 0.4); const heart = acc[c.category] >= 1; if (heart) acc[c.category] -= 1; if (heart) hearted.push(c.id); events.push(ev(sid, c.id, heart ? 'heart' : 'veto', t0 + 3_600_000 + k * 9000)); }
    });
    const buys = copick ? hearted.length > 0 && r() < 0.55 : r() < 0.3;
    if (buys) events.push(ev(sid, copick ? hearted[0] : pool[0].id, 'purchase', t0 + 7_200_000));
  }
  await db.delete(schema.merchantEvents).where(eq(schema.merchantEvents.seeded, true));
  for (let i = 0; i < events.length; i += 100) await db.insert(schema.merchantEvents).values(events.slice(i, i + 100));
  console.log(`Seeded ${events.length} demo merchant events.`);
}

async function main() {
  await ensureBucket();   // no-op unless the Supabase storage driver is configured
  await seedCatalog();
  await seedDemoEvents();
  await client.end();
}
main().catch(async (e) => { console.error(e); await client.end({ timeout: 1 }); process.exit(1); });
