import { z } from 'zod';
import { db, schema } from '@/db';
import { config } from '@/lib/config';
import { hashToken, newId, newInviteToken } from '@/lib/tokens';

const INVITE_DAYS = 14;
const Body = z.object({
  giverName: z.string().trim().min(1).max(40),
  recipientFirstName: z.string().trim().min(1).max(40),
  occasion: z.enum(['birthday', 'holiday', 'anniversary', 'thank-you']),
  budgetMin: z.number().int().min(0).max(5000),
  budgetMax: z.number().int().min(1).max(5000),
  mode: z.enum(['surprise', 'copick']),
}).refine((b) => b.budgetMin <= b.budgetMax, { message: 'Minimum budget must not exceed maximum', path: ['budgetMin'] });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_input', issues: parsed.error.flatten() }, { status: 400 });
  }
  const id = newId();
  const token = newInviteToken();
  const now = new Date();
  await db.insert(schema.giftSessions).values({
    id, ...parsed.data, status: 'invited', inviteTokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + INVITE_DAYS * 86_400_000), createdAt: now,
  });
  // The raw token is returned once and never stored; only its hash is persisted.
  return Response.json({ id, inviteUrl: `${config.appUrl}/invite/${token}` }, { status: 201 });
}
