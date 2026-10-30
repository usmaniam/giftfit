import type { schema } from '@/db';
import { blockedReason } from '../boundaries';

type Item = typeof schema.catalogItems.$inferSelect;
type Profile = typeof schema.recipientProfiles.$inferSelect;
type Session = typeof schema.giftSessions.$inferSelect;
export type Cand = { item: Item; score: number; signals: string[] };

/** Abstract label only, and only if the recipient opted in. Never the raw profile. */
export function sharedUndertone(p: Profile): 'warm' | 'cool' | 'neutral' | null {
  if (!p.shareColorProfile || !p.colorProfileJson) return null;
  try {
    const u = JSON.parse(p.colorProfileJson)?.undertone;
    return u === 'warm' || u === 'cool' || u === 'neutral' ? u : null;
  } catch { return null; }
}

/** Stage 1 + 2: hard filter (server-enforced limits), then deterministic scoring. Sorted best-first, stable. */
export function rank(catalog: Item[], p: Profile, s: Session): Cand[] {
  const mid = (s.budgetMin + s.budgetMax) / 2;
  const half = (s.budgetMax - s.budgetMin) / 2;
  const undertone = sharedUndertone(p);
  const out: Cand[] = [];
  for (const item of catalog) {
    if (blockedReason(item, p, s)) continue;
    let score = 10;
    const signals: string[] = [];
    if (item.tags.includes(s.occasion)) { score += 30; signals.push(`fits the ${s.occasion.replace('-', ' ')} occasion`); }
    if (item.category === 'look') score += 12;
    else {
      const fit = Math.max(0, 1 - Math.abs(item.price - mid) / (half + 1));
      score += Math.round(fit * 25);
      signals.push(fit >= 0.6 ? 'priced near the middle of the budget' : 'within budget');
    }
    if (p.metalPref !== 'any' && item.metal === p.metalPref) score += 15; // not surfaced: would reveal a private preference
    if (undertone && item.metal && ((undertone === 'warm' && item.metal === 'gold') || (undertone === 'cool' && item.metal === 'silver'))) {
      score += 10; signals.push('metal suits the undertone they chose to share');
    }
    out.push({ item, score, signals });
  }
  return out.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
}

/** Category diversity: at most `maxPerCat` per category first, then fill from the remainder if the recipient allowed few categories. */
export function selectDiverse<T extends { category: string }>(order: T[], count: number, maxPerCat = 2): T[] {
  const picked: T[] = [];
  const per = new Map<string, number>();
  for (const x of order) {
    if (picked.length >= count) break;
    if ((per.get(x.category) ?? 0) >= maxPerCat) continue;
    picked.push(x); per.set(x.category, (per.get(x.category) ?? 0) + 1);
  }
  for (const x of order) if (picked.length < count && !picked.includes(x)) picked.push(x);
  return picked;
}
