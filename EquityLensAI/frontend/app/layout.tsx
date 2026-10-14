import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { QueryProvider } from '@/components/providers/QueryProvider';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'EquityLensAI',
  description: 'AI-powered market intelligence and equity research platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <QueryProvider>
          <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_42%)]">
            <SiteHeader />
            {children}
            <SiteFooter />
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
