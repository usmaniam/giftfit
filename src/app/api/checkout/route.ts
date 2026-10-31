import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSession } from '@/lib/sessions';
import { giverCanSee } from '@/lib/render/visibility';
import { newId } from '@/lib/tokens';
import { logEvent } from '@/lib/events';

// Mock checkout: no payment, address, or personal data is collected. It only records a demo purchase event.
export async function POST(req: Request) {
  const parsed = z.object({ sessionId: z.string().min(1), itemId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_input' }, { status: 400 });
  const { sessionId, itemId } = parsed.data;
  const s = await getSession(sessionId);
  if (!s || s.status === 'deleted' || !(await giverCanSee(sessionId, itemId))) return Response.json({ error: 'not_found' }, { status: 404 });
  const [rendered] = await db.select().from(schema.renders).where(and(eq(schema.renders.sessionId, sessionId), eq(schema.renders.itemId, itemId), eq(schema.renders.status, 'success')));
  if (!rendered) return Response.json({ error: 'not_previewed' }, { status: 409 });
  const [item] = await db.select().from(schema.catalogItems).where(eq(schema.catalogItems.id, itemId));
  await logEvent(sessionId, itemId, 'purchase');
  return Response.json({ orderId: 'GF-' + newId().slice(0, 6).toUpperCase(), name: item.name, price: item.price, recipientFirstName: s.recipientFirstName }, { status: 201 });
}
