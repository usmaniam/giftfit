import Link from 'next/link';
import { config } from '@/lib/config';
import { btn, h1, pill } from '@/components/ui';
import DemoButton from '@/components/DemoButton';

export default function Landing() {
  return (
    <>
      {config.demoMode && <p className={pill}>Demo mode: cached renders, no photo is sent anywhere</p>}
      <h1 className={`${h1} mt-5`}>See the gift on them before you buy it.</h1>
      <p className="text-muted">
        Send a private link. They share one selfie and set their limits. You preview real
        candidates on them, and the surprise stays intact.
      </p>
      <div className="my-7 h-2.5 rounded-full bg-ribbon" aria-hidden />
      <div className="flex flex-wrap items-center gap-3">
        <Link className={btn} href="/gift/new">Start a gift</Link>
        {config.demoMode && <DemoButton />}
      </div>
      <p className="mt-7 text-[15px] text-muted">
        Previews show style, not exact fit. Recipients can delete everything at any time.
      </p>
      <p className="mt-2 text-sm text-muted"><Link className="underline" href="/merchant">Merchant view (demo data)</Link></p>
    </>
  );
}
