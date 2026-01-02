import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Fountain: File Merger - Free Online File Combiner Tool',
  description: 'Merge multiple PDF, CSV, Word documents, and images into one file instantly. Free, secure, and privacy-focused. All processing happens in your browser - your files never leave your device.',
  keywords: ['file merger', 'PDF merger', 'PDF combiner', 'merge PDF', 'combine files', 'file tool', 'free file merger', 'online file tool', 'merge images', 'merge CSV', 'merge Word'],
  authors: [{ name: 'Fountain: File Merger' }],
  creator: 'Fountain: File Merger',
  publisher: 'Fountain: File Merger',
  openGraph: {
    title: 'Fountain: File Merger - Free Online File Combiner Tool',
    description: 'Merge multiple PDF, CSV, Word documents, and images into one file instantly. Free, secure, and privacy-focused.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fountain: File Merger - Free Online File Combiner Tool',
    description: 'Merge multiple PDF, CSV, Word documents, and images into one file instantly. Free, secure, and privacy-focused.',
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

