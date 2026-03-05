'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-8">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/booking" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">Privacy & Escrow</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 prose prose-invert prose-sm max-w-none">
        <p className="text-white/80">
          Your personal data is handled in accordance with GDPR. Payment information is secured and never stored in plain text.
          In case of dispute, funds may be placed in escrow until resolution.
        </p>
        <p className="text-white/60 text-sm mt-4">
          Contact: support@bolh-security.com
        </p>
      </main>
    </div>
  )
}
