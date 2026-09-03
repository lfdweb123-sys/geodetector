import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GeoLock',
  description: 'Multi-signal location verification platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
