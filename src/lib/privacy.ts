import { and, eq, inArray, lt, isNotNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { storage } from './storage';

async function dropAssets(ids: string[]) {
  if (!ids.length) return;
  await Promise.all(ids.map((id) => storage.remove(id)));
  db.delete(schema.assets).where(inArray(schema.assets.id, ids)).run();
}

/** Removes selfie/hand files and clears the profile references. Used on consent revoke and delete-all. */
export async function purgePhotos(sessionId: string) {
  const p = db.select().from(schema.recipientProfiles).where(eq(schema.recipientProfiles.sessionId, sessionId)).get();
  if (!p) return;
  await dropAssets([p.selfieAssetId, p.handAssetId].filter((x): x is string => !!x));
  db.update(schema.recipientProfiles).set({ selfieAssetId: null, handAssetId: null }).where(eq(schema.recipientProfiles.sessionId, sessionId)).run();
}

/** Recipient or giver "delete everything": photos, renders, picks, free-text, shared profile. */
export async function purgeSession(sessionId: string) {
  await purgePhotos(sessionId);
  const renders = db.select().from(schema.renders).where(eq(schema.renders.sessionId, sessionId)).all();
  await dropAssets(renders.map((r) => r.resultAssetId).filter((x): x is string => !!x));
  db.delete(schema.renders).where(eq(schema.renders.sessionId, sessionId)).run();
  db.delete(schema.picks).where(eq(schema.picks.sessionId, sessionId)).run();
  db.delete(schema.merchantEvents).where(and(eq(schema.merchantEvents.sessionId, sessionId), eq(schema.merchantEvents.seeded, false))).run();
  db.update(schema.recipientProfiles).set({
    consentRender: false, consentShareRenders: false, noGoText: null, colorProfileJson: null,
    shareColorProfile: false, allowedCategories: [], avoidColors: [],
  }).where(eq(schema.recipientProfiles.sessionId, sessionId)).run();
  db.update(schema.giftSessions).set({ status: 'deleted' }).where(eq(schema.giftSessions.id, sessionId)).run();
}

/** Opportunistic retention sweep: deletes assets past the recipient's chosen expiry. */
export async function purgeExpired() {
  const expired = db.select().from(schema.assets)
    .where(and(isNotNull(schema.assets.expiresAt), lt(schema.assets.expiresAt, new Date()))).all();
  if (!expired.length) return;
  const ids = expired.map((a) => a.id);
  db.update(schema.recipientProfiles).set({ selfieAssetId: null }).where(inArray(schema.recipientProfiles.selfieAssetId, ids)).run();
  db.update(schema.recipientProfiles).set({ handAssetId: null }).where(inArray(schema.recipientProfiles.handAssetId, ids)).run();
  await dropAssets(ids);
}
