'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-8">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/booking" className="p-2 rounded-lg hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">Terms and Conditions</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 prose prose-invert prose-sm max-w-none">
        <p className="text-white/80">
          By using BOLH SECURITY, you agree to our terms and conditions.
          Reservations are subject to availability. Payment is due under the terms shown at booking.
        </p>
        <p className="text-white/60 text-sm mt-4">
          For questions: support@bolh-security.com
        </p>
      </main>
    </div>
  )
}
