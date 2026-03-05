import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { LocaleProvider } from '@/context/LocaleContext'
import { AIChatShell } from '@/components/AIChatShell'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'

export const metadata: Metadata = {
  title: 'BOLH — Охрана по запросу',
  description: 'Закажи проверенного охранника за минуты',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-[#1a1b26] text-white">
        <RootErrorBoundary>
          <LocaleProvider>
            <AuthProvider>
              <AIChatShell>
                {children}
              </AIChatShell>
            </AuthProvider>
          </LocaleProvider>
        </RootErrorBoundary>
      </body>
    </html>
  )
}
