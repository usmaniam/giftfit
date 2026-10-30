import { and, eq, inArray, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import { config } from '../config';
import { blockedReason } from '../boundaries';
import { ADAPTERS } from './adapters';
import { enqueueRender, pump } from './queue';

type Session = typeof schema.giftSessions.$inferSelect;
type Profile = typeof schema.recipientProfiles.$inferSelect;
export type RenderRequestResult =
  | { error: 'recipient_not_ready' | 'share_consent_required'; httpStatus: 409 | 403 }
  | { accepted: { id: string; itemId: string }[]; rejected: { itemId: string; reason: string }[] };

/** The one place that decides whether renders may start. Shared by the renders route and the agent. */
export async function requestRenders(s: Session, p: Profile, itemIds: string[]): Promise<RenderRequestResult> {
  if (!p.consentRender || !p.selfieAssetId || s.status === 'created' || s.status === 'invited') return { error: 'recipient_not_ready', httpStatus: 409 };
  if (!p.consentShareRenders) return { error: 'share_consent_required', httpStatus: 403 };

  const existing = db.select().from(schema.renders).where(and(eq(schema.renders.sessionId, s.id), ne(schema.renders.status, 'error'))).all();
  const items = db.select().from(schema.catalogItems).where(inArray(schema.catalogItems.id, itemIds)).all();
  const accepted: { id: string; itemId: string }[] = [];
  const rejected: { itemId: string; reason: string }[] = [];

  for (const itemId of [...new Set(itemIds)]) {
    const item = items.find((i) => i.id === itemId);
    const reason = !item ? 'unknown_item'
      : existing.some((r) => r.itemId === itemId) || accepted.some((a) => a.itemId === itemId) ? 'already_requested'
      : existing.length + accepted.length >= config.maxRendersPerSession ? 'render_budget_exhausted'
      : blockedReason(item, p, s);
    if (reason) { rejected.push({ itemId, reason }); continue; }
    accepted.push({ id: enqueueRender(s.id, itemId, ADAPTERS[item!.category].endpoint ?? 'demo'), itemId });
  }
  await pump();
  return { accepted, rejected };
}
