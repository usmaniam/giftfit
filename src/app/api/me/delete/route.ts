import { z } from 'zod';
import { getSessionByToken } from '@/lib/sessions';
import { purgeSession } from '@/lib/privacy';

// Recipient "Delete my data now": wipes photos, renders, picks and preferences, and deactivates the link.
export async function POST(req: Request) {
  const parsed = z.object({ token: z.string().min(10) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_input' }, { status: 400 });
  const s = await getSessionByToken(parsed.data.token);
  if (!s) return Response.json({ error: 'not_found' }, { status: 404 });
  await purgeSession(s.id);
  return Response.json({ ok: true });
}
