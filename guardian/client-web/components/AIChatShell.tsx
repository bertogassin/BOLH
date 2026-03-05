'use client'

import { AIChatProvider } from '@/context/AIChatContext'
import { AIChatPanel } from '@/components/AIChatPanel'

export function AIChatShell({ children }: { children: React.ReactNode }) {
  return (
    <AIChatProvider>
      {children}
      <AIChatPanel />
    </AIChatProvider>
  )
}
