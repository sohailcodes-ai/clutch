import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { SessionProvider } from '@/lib/session'
import './globals.css'

export const metadata: Metadata = {
  title: 'Clutch - Competitive coding duels',
  description:
    'A premium competitive arena where developers queue by stack, solve under pressure, and climb rating ladders through head-to-head matches.',
  openGraph: {
    title: 'Clutch - Code under pressure',
    description: 'Head-to-head coding duels with stack-specific ratings.',
    type: 'website',
  },
  icons: {
    icon: [
      {
        url: '/brand/clutch-logo.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#171613',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        <SessionProvider>{children}</SessionProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
