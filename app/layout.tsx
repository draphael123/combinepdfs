import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PDF Merger - Free Online PDF Combiner Tool',
  description: 'Merge multiple PDF files into one document instantly. Free, secure, and privacy-focused. All processing happens in your browser - your files never leave your device.',
  keywords: ['PDF merger', 'PDF combiner', 'merge PDF', 'combine PDF', 'PDF tool', 'free PDF merger', 'online PDF tool'],
  authors: [{ name: 'PDF Merger' }],
  creator: 'PDF Merger',
  publisher: 'PDF Merger',
  openGraph: {
    title: 'PDF Merger - Free Online PDF Combiner Tool',
    description: 'Merge multiple PDF files into one document instantly. Free, secure, and privacy-focused.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDF Merger - Free Online PDF Combiner Tool',
    description: 'Merge multiple PDF files into one document instantly. Free, secure, and privacy-focused.',
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}

