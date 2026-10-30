import './globals.css';
import type { Metadata, Viewport } from 'next';
import { config } from '@/lib/config';

export const metadata: Metadata = {
  title: 'GiftFit',
  description: 'See the gift on them before you buy it, without spoiling the surprise.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-[17px] leading-relaxed antialiased">
        <main className="mx-auto max-w-xl px-5 pt-[max(24px,env(safe-area-inset-top))] pb-[max(32px,env(safe-area-inset-bottom))]">
          {children}
          {config.reportEmail && (
            <p className="mt-10 text-sm text-muted">
              <a className="underline" href={`mailto:${config.reportEmail}?subject=GiftFit%20report`}>Report misuse</a>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
