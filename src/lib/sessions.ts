import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { hashToken } from './tokens';

export type SessionRow = typeof schema.giftSessions.$inferSelect;

export async function getSession(id: string): Promise<SessionRow | undefined> {
  const [row] = await db.select().from(schema.giftSessions).where(eq(schema.giftSessions.id, id));
  return row;
}

/** Returns the session for a valid, unexpired, undeleted invite token; otherwise undefined. */
export async function getSessionByToken(token: string): Promise<SessionRow | undefined> {
  const [row] = await db.select().from(schema.giftSessions)
    .where(eq(schema.giftSessions.inviteTokenHash, hashToken(token)));
  if (!row || row.status === 'deleted' || row.expiresAt.getTime() < Date.now()) return undefined;
  return row;
}

/** Fields safe to send to the giver's browser. Never includes the token hash. */
export const publicSession = (s: SessionRow) => ({
  id: s.id, recipientFirstName: s.recipientFirstName, occasion: s.occasion,
  budgetMin: s.budgetMin, budgetMax: s.budgetMax, mode: s.mode, status: s.status,
  expiresAt: s.expiresAt.toISOString(),
});
