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
      <main className="mx-auto max-w-lg px-4 py-6 space-y-4 text-sm">
        <p className="text-white/60">Last updated: 2026-03-05</p>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-base font-semibold mb-2">Data We Collect</h2>
          <p className="text-white/80">
            We collect account data required to provide the service, such as name, email, and order details.
          </p>
        </section>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-base font-semibold mb-2">How We Use Data</h2>
          <p className="text-white/80">
            Data is used for account access, service fulfillment, fraud prevention, and support.
          </p>
        </section>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-base font-semibold mb-2">Security and Retention</h2>
          <p className="text-white/80">
            Data is transmitted over secure channels. We retain data only as needed for legal and operational purposes.
          </p>
        </section>
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-base font-semibold mb-2">Data Deletion Requests</h2>
          <p className="text-white/80">
            To request account or data deletion, contact support@bolh-security.com from your account email.
          </p>
        </section>
        <p className="text-white/60">
          Contact: support@bolh-security.com
        </p>
      </main>
    </div>
  )
}
