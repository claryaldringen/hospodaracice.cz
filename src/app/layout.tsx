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
  metadataBase: new URL('https://hospodaracice.cz'),
  title: 'Hospoda na Palouku - Račice nad Berounkou',
  description:
    'Hospoda Na Palouku v Račicích nad Berounkou. Denní menu, týdenní nabídka, stálá nabídka. Rodinná restaurace s českou kuchyní.',
  keywords: [
    'hospoda',
    'restaurace',
    'Račice nad Berounkou',
    'denní menu',
    'týdenní nabídka',
    'česká kuchyně',
    'Hospoda Na Palouku',
    'obědy',
    'stálá nabídka',
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Hospoda na Palouku - Račice nad Berounkou',
    description:
      'Hospoda Na Palouku v Račicích nad Berounkou. Denní menu, týdenní nabídka, stálá nabídka.',
    locale: 'cs_CZ',
    type: 'website',
    siteName: 'Hospoda Na Palouku',
    url: 'https://hospodaracice.cz',
    images: [
      {
        url: '/logo_Bakalar.png',
        width: 512,
        height: 512,
        alt: 'Logo Hospody Na Palouku',
      },
    ],
  },
  icons: {
    icon: '/favicon.ico',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: 'Hospoda Na Palouku',
  url: 'https://hospodaracice.cz',
  telephone: ['+420 702 181 247', '+420 603 263 291'],
  email: 'hospoda@obec-racice.cz',
  servesCuisine: 'Česká kuchyně',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Račice 42',
    addressLocality: 'Račice',
    postalCode: '270 24',
    addressCountry: 'CZ',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 50.0608,
    longitude: 13.8992,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday'],
      opens: '11:00',
      closes: '15:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Friday', 'Saturday'],
      opens: '11:00',
      closes: '23:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Sunday'],
      opens: '11:00',
      closes: '19:00',
    },
  ],
  image: 'https://hospodaracice.cz/logo_Bakalar.png',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
