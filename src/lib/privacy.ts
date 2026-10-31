import { and, eq, inArray, lt, isNotNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { storage } from './storage';

async function dropAssets(ids: string[]) {
  if (!ids.length) return;
  await Promise.all(ids.map((id) => storage.remove(id)));
  await db.delete(schema.assets).where(inArray(schema.assets.id, ids));
}

/** Removes selfie/hand files and clears the profile references. Used on consent revoke and delete-all. */
export async function purgePhotos(sessionId: string) {
  const [p] = await db.select().from(schema.recipientProfiles).where(eq(schema.recipientProfiles.sessionId, sessionId));
  if (!p) return;
  await dropAssets([p.selfieAssetId, p.handAssetId].filter((x): x is string => !!x));
  await db.update(schema.recipientProfiles).set({ selfieAssetId: null, handAssetId: null }).where(eq(schema.recipientProfiles.sessionId, sessionId));
}

/** Recipient or giver "delete everything": photos, renders, picks, free-text, shared profile. */
export async function purgeSession(sessionId: string) {
  await purgePhotos(sessionId);
  const renders = await db.select().from(schema.renders).where(eq(schema.renders.sessionId, sessionId));
  await dropAssets(renders.map((r) => r.resultAssetId).filter((x): x is string => !!x));
  await db.delete(schema.renders).where(eq(schema.renders.sessionId, sessionId));
  await db.delete(schema.picks).where(eq(schema.picks.sessionId, sessionId));
  await db.delete(schema.merchantEvents).where(and(eq(schema.merchantEvents.sessionId, sessionId), eq(schema.merchantEvents.seeded, false)));
  await db.update(schema.recipientProfiles).set({
    consentRender: false, consentShareRenders: false, noGoText: null, colorProfileJson: null,
    shareColorProfile: false, allowedCategories: [], avoidColors: [],
  }).where(eq(schema.recipientProfiles.sessionId, sessionId));
  await db.update(schema.giftSessions).set({ status: 'deleted' }).where(eq(schema.giftSessions.id, sessionId));
}

/** Retention sweep: deletes assets past the recipient's chosen expiry. Runs on a daily cron and opportunistically on invite loads. */
export async function purgeExpired() {
  const expired = await db.select().from(schema.assets)
    .where(and(isNotNull(schema.assets.expiresAt), lt(schema.assets.expiresAt, new Date())));
  if (!expired.length) return 0;
  const ids = expired.map((a) => a.id);
  await db.update(schema.recipientProfiles).set({ selfieAssetId: null }).where(inArray(schema.recipientProfiles.selfieAssetId, ids));
  await db.update(schema.recipientProfiles).set({ handAssetId: null }).where(inArray(schema.recipientProfiles.handAssetId, ids));
  await dropAssets(ids);
  return ids.length;
}
