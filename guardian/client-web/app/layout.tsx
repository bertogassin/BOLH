import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { LocaleProvider } from '@/context/LocaleContext'
import { SoundProvider } from '@/context/SoundContext'
import { ApiHealthProvider } from '@/context/ApiHealthContext'
import { AIChatShell } from '@/components/AIChatShell'
import { ApiHealthBanner } from '@/components/ApiHealthBanner'
import { GlobalBackButton } from '@/components/GlobalBackButton'
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
      <body className="min-h-screen antialiased bg-[#0b0f19] text-white">
        <div className="relative mx-auto w-full max-w-[430px] min-h-screen min-h-[100dvh] overflow-x-hidden bg-[#1a1b26] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_60px_rgba(0,0,0,0.45)]">
          <RootErrorBoundary>
            <LocaleProvider>
              <ApiHealthProvider>
                <AuthProvider>
                  <SoundProvider>
                    <AIChatShell>
                      <GlobalBackButton />
                      <ApiHealthBanner />
                      {children}
                    </AIChatShell>
                  </SoundProvider>
                </AuthProvider>
              </ApiHealthProvider>
            </LocaleProvider>
          </RootErrorBoundary>
        </div>
      </body>
    </html>
  )
}
