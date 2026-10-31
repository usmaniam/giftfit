import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db, schema } from '@/db';
import { config } from '@/lib/config';
import { CATEGORIES } from '@/lib/constants';
import { storage } from '@/lib/storage';
import { hashToken, newId, newInviteToken } from '@/lib/tokens';

/** Demo mode only: a ready session for an AI-generated sample recipient, so the app can be explored without the invite step. */
export async function POST() {
  if (!config.demoMode) return Response.json({ error: 'not_found' }, { status: 404 });
  const sample = await readFile(path.join(process.cwd(), 'fixtures/demo/sample-person.jpg'));
  const now = new Date(), expires = new Date(now.getTime() + 7 * 86_400_000);
  const id = newId(), selfie = newId(), hand = newId();
  await Promise.all([storage.put(selfie, sample), storage.put(hand, sample)]);
  await db.insert(schema.assets).values([
    { id: selfie, kind: 'selfie', path: selfie, expiresAt: expires }, { id: hand, kind: 'hand', path: hand, expiresAt: expires },
  ]);
  await db.insert(schema.giftSessions).values({
    id, giverName: 'You', recipientFirstName: 'Maya', occasion: 'birthday', budgetMin: 25, budgetMax: 150, mode: 'surprise',
    status: 'ready', inviteTokenHash: hashToken(newInviteToken()), expiresAt: new Date(now.getTime() + 14 * 86_400_000), createdAt: now,
  });
  await db.insert(schema.recipientProfiles).values({
    sessionId: id, consentRender: true, consentShareRenders: true, deleteAfterDays: 7, selfieAssetId: selfie, handAssetId: hand,
    allowedCategories: [...CATEGORIES], metalPref: 'any', avoidColors: [],
  });
  return Response.json({ id }, { status: 201 });
}
