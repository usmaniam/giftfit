import { getSessionByToken } from '@/lib/sessions';
import { h1 } from '@/components/ui';
import RecipientFlow from '@/components/RecipientFlow';

export const dynamic = 'force-dynamic';

export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!getSessionByToken(token)) {
    return (<><h1 className={h1}>This link isn’t active</h1>
      <p className="text-muted">It may have expired or been deleted. Ask the person who sent it for a new one.</p></>);
  }
  return <RecipientFlow token={token} />;
}
