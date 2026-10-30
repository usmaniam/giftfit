import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSessionByToken } from '@/lib/sessions';
import { ensureProfile } from '@/lib/profile';
import { parseImage } from '@/lib/images';
import { storage } from '@/lib/storage';
import { newId } from '@/lib/tokens';

const MAX_BYTES = 8 * 1024 * 1024;
const MIN_SIDE = 512; // YouCam scarf/bag minimum
type Ctx = { params: Promise<{ token: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const s = getSessionByToken((await params).token);
  if (!s) return Response.json({ error: 'not_found' }, { status: 404 });
  const profile = ensureProfile(s.id);
  if (!profile.consentRender) return Response.json({ error: 'consent_required' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const kind = form?.get('kind');
  const file = form?.get('file');
  if ((kind !== 'selfie' && kind !== 'hand') || !(file instanceof File)) return Response.json({ error: 'invalid_input' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'too_large' }, { status: 413 });

  const img = parseImage(Buffer.from(await file.arrayBuffer()));
  if (!img) return Response.json({ error: 'unsupported_image', hint: 'Use a JPEG or PNG photo.' }, { status: 415 });
  if (Math.min(img.width, img.height) < MIN_SIDE) {
    return Response.json({ error: 'too_small', hint: `Photo must be at least ${MIN_SIDE}×${MIN_SIDE}.` }, { status: 422 });
  }

  const col = kind === 'selfie' ? 'selfieAssetId' : 'handAssetId';
  const oldId = profile[col];
  const id = newId();
  await storage.put(id, img.bytes);
  db.insert(schema.assets).values({
    id, kind, path: id, expiresAt: new Date(Date.now() + profile.deleteAfterDays * 86_400_000),
  }).run();
  db.update(schema.recipientProfiles).set({ [col]: id }).where(eq(schema.recipientProfiles.sessionId, s.id)).run();
  if (oldId) { await storage.remove(oldId); db.delete(schema.assets).where(eq(schema.assets.id, oldId)).run(); }
  return Response.json({ ok: true, kind, width: img.width, height: img.height }, { status: 201 });
}
