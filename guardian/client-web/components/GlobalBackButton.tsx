'use client'

import { ArrowLeft } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

const HIDDEN_ROUTES = new Set([
  '/',
  '/booking',
  '/map',
  '/profile',
  '/login',
  '/register',
])

export function GlobalBackButton() {
  const router = useRouter()
  const pathname = usePathname()

  if (!pathname || HIDDEN_ROUTES.has(pathname)) {
    return null
  }

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push('/booking')
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Go back"
      className="fixed left-3 z-40 h-11 w-11 rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      <ArrowLeft className="mx-auto h-5 w-5" />
    </button>
  )
}
