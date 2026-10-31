import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';

/**
 * Surprise: the giver sees all renders. Co-pick: only items the recipient hearted. Requires recipient share consent.
 * Returns a predicate so list endpoints load the session state once instead of once per item.
 */
export async function giverVisibility(sessionId: string): Promise<(itemId: string) => boolean> {
  const [[s], [p]] = await Promise.all([
    db.select().from(schema.giftSessions).where(eq(schema.giftSessions.id, sessionId)),
    db.select().from(schema.recipientProfiles).where(eq(schema.recipientProfiles.sessionId, sessionId)),
  ]);
  if (!s || s.status === 'deleted' || !p?.consentShareRenders) return () => false;
  if (s.mode === 'surprise') return () => true;
  const hearted = await db.select({ itemId: schema.picks.itemId }).from(schema.picks)
    .where(and(eq(schema.picks.sessionId, sessionId), eq(schema.picks.recipientReaction, 'heart')));
  const ids = new Set(hearted.map((h) => h.itemId));
  return (itemId) => ids.has(itemId);
}

export async function giverCanSee(sessionId: string, itemId: string): Promise<boolean> {
  return (await giverVisibility(sessionId))(itemId);
}
