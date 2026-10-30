import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSessionByToken } from '@/lib/sessions';
import { ensureProfile, recipientView } from '@/lib/profile';
import { purgeExpired, purgePhotos } from '@/lib/privacy';
import { CATEGORIES, COLORS, DELETE_AFTER_DAYS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ token: string }> };

const Patch = z.object({
  consentRender: z.boolean(),
  consentShareRenders: z.boolean(),
  deleteAfterDays: z.number().refine((n) => (DELETE_AFTER_DAYS as readonly number[]).includes(n)),
  allowedCategories: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length),
  metalPref: z.enum(['gold', 'silver', 'any']),
  avoidColors: z.array(z.enum(COLORS)).max(COLORS.length),
  noGoText: z.string().trim().max(300),
  shareColorProfile: z.boolean(),
}).partial();

export async function GET(_: Request, { params }: Ctx) {
  await purgeExpired();
  const s = getSessionByToken((await params).token);
  if (!s) return Response.json({ error: 'not_found' }, { status: 404 });
  const profile = ensureProfile(s.id);
  const photo = profile.selfieAssetId ? db.select().from(schema.assets).where(eq(schema.assets.id, profile.selfieAssetId)).get() : undefined;
  return Response.json({
    session: { giverName: s.giverName, recipientFirstName: s.recipientFirstName, occasion: s.occasion, mode: s.mode, status: s.status },
    profile: { ...recipientView(profile), photosDeleteAt: photo?.expiresAt?.toISOString() ?? null },
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  const s = getSessionByToken((await params).token);
  if (!s) return Response.json({ error: 'not_found' }, { status: 404 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_input' }, { status: 400 });
  const before = ensureProfile(s.id);
  const { noGoText, ...rest } = parsed.data;
  db.update(schema.recipientProfiles)
    .set({ ...rest, ...(noGoText !== undefined ? { noGoText: noGoText || null } : {}) })
    .where(eq(schema.recipientProfiles.sessionId, s.id)).run();
  // Withdrawing render consent immediately deletes the photos and pulls the session back from "ready".
  if (parsed.data.consentRender === false && before.consentRender) {
    await purgePhotos(s.id);
    db.update(schema.giftSessions).set({ status: 'invited' }).where(eq(schema.giftSessions.id, s.id)).run();
  }
  return Response.json({ profile: recipientView(ensureProfile(s.id)) });
}
