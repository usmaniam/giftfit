import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSessionByToken } from '@/lib/sessions';
import { ensureProfile } from '@/lib/profile';

export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const s = getSessionByToken((await params).token);
  if (!s) return Response.json({ error: 'not_found' }, { status: 404 });
  const p = ensureProfile(s.id);
  const missing = [
    !p.consentRender && 'consent', !p.selfieAssetId && 'selfie', p.allowedCategories.length === 0 && 'categories',
  ].filter(Boolean);
  if (missing.length) return Response.json({ error: 'incomplete', missing }, { status: 409 });
  db.update(schema.giftSessions).set({ status: 'ready' }).where(eq(schema.giftSessions.id, s.id)).run();
  return Response.json({ ok: true, status: 'ready' });
}
