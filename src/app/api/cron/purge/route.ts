import { config } from '@/lib/config';
import { purgeExpired } from '@/lib/privacy';

export const dynamic = 'force-dynamic';

// Daily retention sweep (see vercel.json). Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  if (!config.cronSecret || req.headers.get('authorization') !== `Bearer ${config.cronSecret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return Response.json({ ok: true, purged: await purgeExpired() });
}
