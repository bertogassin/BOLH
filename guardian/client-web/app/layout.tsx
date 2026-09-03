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
      <body className="min-h-screen antialiased text-white">
        <div className="bolh-app-frame relative mx-auto min-h-screen min-h-[100dvh] w-full max-w-[480px] overflow-x-hidden">
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
