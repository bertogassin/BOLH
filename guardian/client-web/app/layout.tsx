import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { LocaleProvider } from '@/context/LocaleContext'
import { SoundProvider } from '@/context/SoundContext'
import { ApiHealthProvider } from '@/context/ApiHealthContext'
import { AIChatShell } from '@/components/AIChatShell'
import { ApiHealthBanner } from '@/components/ApiHealthBanner'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'

export const metadata: Metadata = {
  title: 'BOLH Security',
  description: 'On-demand security services',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-[#1a1b26] text-white">
        <RootErrorBoundary>
          <LocaleProvider>
            <ApiHealthProvider>
              <AuthProvider>
                <SoundProvider>
                  <AIChatShell>
                    <ApiHealthBanner />
                    {children}
                  </AIChatShell>
                </SoundProvider>
              </AuthProvider>
            </ApiHealthProvider>
          </LocaleProvider>
        </RootErrorBoundary>
      </body>
    </html>
  )
}
