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
      <main className="mx-auto max-w-lg px-4 py-6 space-y-4 text-sm">
        <p className="text-white/60">Last updated: 2026-03-05</p>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-base font-semibold mb-2">Use of Service</h2>
          <p className="text-white/80">
            By using BOLH Security, you agree to use the app lawfully and provide accurate account information.
          </p>
        </section>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-base font-semibold mb-2">Orders and Payments</h2>
          <p className="text-white/80">
            Service requests are subject to provider availability. Pricing and payment terms are shown during booking.
          </p>
        </section>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-base font-semibold mb-2">User Responsibilities</h2>
          <p className="text-white/80">
            You are responsible for account security and activities under your account credentials.
          </p>
        </section>
        <p className="text-white/60">
          Contact: support@bolh-security.com
        </p>
      </main>
    </div>
  )
}
