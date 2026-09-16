import type { Metadata, Viewport } from 'next';
import { Archivo, Inter, Newsreader } from 'next/font/google';
import './globals.css';

/**
 * Archivo carries a real width axis, which is what gives headlines and the
 * scoreboard their condensed athletic proportions without a second font file
 * or a scaleX() hack. See docs/DESIGN-SYSTEM.md section 2.
 */
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  axes: ['wdth'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mobydicks.org'),
  title: {
    default: 'The Melville Moby Dicks',
    template: '%s — Melville Moby Dicks',
  },
  description:
    'Official home of the Melville Moby Dicks. Roster, schedule, live scores, statistics and the Captain’s Log.',
  openGraph: {
    type: 'website',
    siteName: 'The Melville Moby Dicks',
    locale: 'en_US',
  },
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  themeColor: '#05070c',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${inter.variable} ${newsreader.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
