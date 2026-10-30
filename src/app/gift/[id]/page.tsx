import { notFound } from 'next/navigation';
import { getSession, publicSession } from '@/lib/sessions';
import GiftStatus, { Ended } from '@/components/GiftStatus';

export const dynamic = 'force-dynamic';

export default async function GiftPage({ params }: { params: Promise<{ id: string }> }) {
  const s = getSession((await params).id);
  if (!s) notFound();
  if (s.status === 'deleted') return <Ended name={s.recipientFirstName} />;
  return <GiftStatus initial={publicSession(s)} />;
}
