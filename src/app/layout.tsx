import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Hospoda na Palouku - Račice nad Berounkou',
  description: 'Oficiální web hospody Na Palouku v Račicích nad Berounkou',
  openGraph: {
    title: 'Hospoda na Palouku - Račice nad Berounkou',
    description: 'Oficiální web hospody Na Palouku v Račicích nad Berounkou',
    locale: 'cs_CZ',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
