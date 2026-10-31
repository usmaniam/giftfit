import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSession } from '@/lib/sessions';
import { giverCanSee } from '@/lib/render/visibility';
import Checkout from '@/components/Checkout';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ item?: string }> }) {
  const { id } = await params;
  const itemId = (await searchParams).item ?? '';
  const s = await getSession(id);
  const [[item], [render]] = await Promise.all([
    db.select().from(schema.catalogItems).where(eq(schema.catalogItems.id, itemId)),
    db.select().from(schema.renders).where(and(eq(schema.renders.sessionId, id), eq(schema.renders.itemId, itemId), eq(schema.renders.status, 'success'))),
  ]);
  if (!s || s.status === 'deleted' || !item || !render || !(await giverCanSee(id, itemId))) redirect(`/gift/${id}`);
  return <Checkout sessionId={id} itemId={itemId} name={item.name} price={item.price} renderId={render.id} recipient={s.recipientFirstName} />;
}
