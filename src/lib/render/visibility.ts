import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';

/** Surprise: the giver sees all renders. Co-pick: only items the recipient hearted. Requires recipient share consent. */
export function giverCanSee(sessionId: string, itemId: string): boolean {
  const s = db.select().from(schema.giftSessions).where(eq(schema.giftSessions.id, sessionId)).get();
  const p = db.select().from(schema.recipientProfiles).where(eq(schema.recipientProfiles.sessionId, sessionId)).get();
  if (!s || s.status === 'deleted' || !p?.consentShareRenders) return false;
  if (s.mode === 'surprise') return true;
  return !!db.select().from(schema.picks).where(and(
    eq(schema.picks.sessionId, sessionId), eq(schema.picks.itemId, itemId), eq(schema.picks.recipientReaction, 'heart'))).get();
}
