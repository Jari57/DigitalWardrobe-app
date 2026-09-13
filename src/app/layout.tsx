import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import InstallApp from '@/components/InstallApp';
import './globals.css';
import './themes.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://fitstalker.com'),
  title: 'FitStalker — See the fit. Find the pieces.',
  description:
    'Upload a screenshot, identify the clothes, and find where to shop similar pieces. Save your favorites and build your next fit.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'FitStalker',
    description: 'See the fit. Find the pieces.',
    url: 'https://fitstalker.com',
    siteName: 'FitStalker',
    type: 'website',
    images: [{ url: '/brand/fitstalker-brand.png', width: 1536, height: 1024 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FitStalker',
    description: 'See the fit. Find the pieces.',
    images: ['/brand/fitstalker-brand.png'],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'FitStalker', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-180.png' },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FAF9F6' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('wardrobe-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}`,
          }}
        />
      </head>
      <body>
        {children}
        <InstallApp />
      </body>
    </html>
  );
}
