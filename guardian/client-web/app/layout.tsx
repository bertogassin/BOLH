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
  const buildId =
    process.env.NEXT_PUBLIC_APP_BUILD_ID ||
    (process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : '') ||
    'dev'

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
                    <div className="pointer-events-none fixed bottom-2 left-2 z-[70] rounded border border-white/25 bg-black/45 px-2 py-1 text-[10px] uppercase tracking-wide text-white/75">
                      build {buildId}
                    </div>
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
