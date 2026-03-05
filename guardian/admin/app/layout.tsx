import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Guardian Admin',
  description: 'Guardian platform control panel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light">
      <body className="min-h-screen bg-gray-50 dark:bg-guardian-dark text-gray-900 dark:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
