'use client'

import Link from 'next/link'
import { Building2 } from 'lucide-react'

type Props = {
  isAgency: boolean
}

export function ProfileBusinessSection({ isAgency }: Props) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-white mb-3">Business dashboard</h2>
      <div className="space-y-1">
        {isAgency ? (
          <Link href="/profile/company-register" className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-white hover:bg-white/15">
            <span className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-white/60" />
              Company registration
            </span>
            <span className="text-white/40">›</span>
          </Link>
        ) : (
          <Link href="/profile/company-register" className="rounded-xl bg-white/10 border border-violet-400 px-4 py-3 flex items-center justify-between text-white hover:bg-white/15">
            <span className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-white/60" />
              Become a partner
            </span>
            <span className="text-white/40">›</span>
          </Link>
        )}
      </div>
    </section>
  )
}

