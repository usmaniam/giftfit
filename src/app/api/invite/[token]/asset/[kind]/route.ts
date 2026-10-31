import { getSessionByToken } from '@/lib/sessions';
import { ensureProfile } from '@/lib/profile';
import { parseImage } from '@/lib/images';
import { storage } from '@/lib/storage';

// Lets the recipient see their own upload. Token-gated; never served to the giver.
export async function GET(_: Request, { params }: { params: Promise<{ token: string; kind: string }> }) {
  const { token, kind } = await params;
  const s = await getSessionByToken(token);
  if (!s || (kind !== 'selfie' && kind !== 'hand')) return new Response(null, { status: 404 });
  const p = await ensureProfile(s.id);
  const id = kind === 'selfie' ? p.selfieAssetId : p.handAssetId;
  if (!id) return new Response(null, { status: 404 });
  const bytes = await storage.get(id).catch(() => null);
  const img = bytes && parseImage(bytes);
  if (!bytes || !img) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: { 'content-type': img.mime, 'cache-control': 'private, no-store' } });
}
