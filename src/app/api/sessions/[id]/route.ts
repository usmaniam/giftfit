import { purgeSession } from '@/lib/privacy';
import { getSession, publicSession } from '@/lib/sessions';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const s = getSession((await params).id);
  if (!s || s.status === 'deleted') return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(publicSession(s));
}

// Giver cancels the session; all recipient data is purged too.
export async function DELETE(_: Request, { params }: Ctx) {
  const s = getSession((await params).id);
  if (!s) return Response.json({ error: 'not_found' }, { status: 404 });
  await purgeSession(s.id);
  return Response.json({ ok: true });
}
