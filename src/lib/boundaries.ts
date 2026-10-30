import type { schema } from '@/db';
import { NEEDS_HAND } from './constants';
import { config } from './config';
import { ADAPTERS, liveBlocker } from './render/adapters';

type Item = typeof schema.catalogItems.$inferSelect;
type Profile = typeof schema.recipientProfiles.$inferSelect;
type Session = typeof schema.giftSessions.$inferSelect;

/** Hard, deterministic filter. Returns a reason code when the item must NOT be rendered, else null. Server-side only. */
export function violation(item: Item, p: Profile, s: Session): string | null {
  if (!p.allowedCategories.includes(item.category)) return 'category_not_allowed';
  if (item.category !== 'look' && (item.price > s.budgetMax || item.price < s.budgetMin)) return 'out_of_budget';
  if (item.colors.some((c) => p.avoidColors.includes(c))) return 'avoided_color';
  if (item.metal && p.metalPref !== 'any' && item.metal !== p.metalPref) return 'metal_mismatch';
  if ((NEEDS_HAND as readonly string[]).includes(item.category) && !p.handAssetId) return 'hand_photo_required';
  if (!config.demoMode && !item.imageSpecOk) return 'product_image_not_vetted';
  return null;
}

/** Everything that stops an item from being proposed or rendered right now: recipient limits, then live-adapter availability. */
export function blockedReason(item: Item, p: Profile, s: Session): string | null {
  return violation(item, p, s) ?? (config.demoMode ? null : liveBlocker(ADAPTERS[item.category], config.youcamExperimental));
}
