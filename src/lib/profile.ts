import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';

export type ProfileRow = typeof schema.recipientProfiles.$inferSelect;

export async function ensureProfile(sessionId: string): Promise<ProfileRow> {
  await db.insert(schema.recipientProfiles).values({ sessionId }).onConflictDoNothing();
  const [row] = await db.select().from(schema.recipientProfiles).where(eq(schema.recipientProfiles.sessionId, sessionId));
  return row;
}

/** What the recipient's own browser may see. noGoText is theirs; photos are exposed only as booleans. */
export const recipientView = (p: ProfileRow) => ({
  consentRender: p.consentRender, consentShareRenders: p.consentShareRenders, deleteAfterDays: p.deleteAfterDays,
  hasSelfie: !!p.selfieAssetId, hasHand: !!p.handAssetId, allowedCategories: p.allowedCategories,
  metalPref: p.metalPref, avoidColors: p.avoidColors, noGoText: p.noGoText ?? '', shareColorProfile: p.shareColorProfile,
});
