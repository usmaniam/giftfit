import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { newId } from './tokens';

type EventType = (typeof schema.merchantEvents.$inferInsert)['type'];

/** Anonymous analytics for the merchant view: a session id, an item id and a type. No names, photos or notes. */
export async function logEvent(sessionId: string, itemId: string, type: EventType) {
  const [item] = await db.select().from(schema.catalogItems).where(eq(schema.catalogItems.id, itemId));
  if (!item) return;
  await db.insert(schema.merchantEvents).values({ id: newId(), merchantId: item.merchantId, sessionId, itemId, type, ts: new Date(), seeded: false });
}

/** A recipient changing their mind replaces the earlier reaction instead of stacking events. */
export async function setReaction(sessionId: string, itemId: string, reaction: 'heart' | 'veto' | null) {
  await db.delete(schema.merchantEvents).where(and(
    eq(schema.merchantEvents.sessionId, sessionId), eq(schema.merchantEvents.itemId, itemId),
    inArray(schema.merchantEvents.type, ['heart', 'veto']), eq(schema.merchantEvents.seeded, false)));
  if (reaction) await logEvent(sessionId, itemId, reaction);
}
