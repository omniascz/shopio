import type { Metadata } from 'next';
import '@shopio/ui/styles/globals.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shopio Storefront',
  description: 'Powered by Shopio',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs-CZ" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
