'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearAdminToken } from '@/lib/api'

type SecuritySummary = {
  signed_request_mode?: string
  nonce_cache_size?: number
  signed_stats?: Record<string, number>
}

export default function SettingsPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<SecuritySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch('/api/security-summary')
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error || 'Failed to load security summary')
        }
        return res.json() as Promise<SecuritySummary>
      })
      .then((data) => {
        if (!alive) return
        setSummary(data)
        setError('')
      })
      .catch((err) => {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Failed to load security summary')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const signedStats = useMemo(() => {
    const entries = Object.entries(summary?.signed_stats || {})
    return entries.sort((a, b) => b[1] - a[1])
  }, [summary?.signed_stats])

  const handleSignOut = () => {
    clearAdminToken()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">System settings</h1>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-red-400 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          Sign out admin
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Signed request mode</p>
          <p className="mt-1 text-xl font-semibold">{summary?.signed_request_mode || 'n/a'}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Nonce cache size</p>
          <p className="mt-1 text-xl font-semibold">{summary?.nonce_cache_size ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Signed metrics keys</p>
          <p className="mt-1 text-xl font-semibold">{signedStats.length}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 dark:bg-gray-800">
        <h2 className="mb-3 text-lg font-semibold">Security runtime stats</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : signedStats.length === 0 ? (
          <p className="text-sm text-gray-500">No runtime stats yet.</p>
        ) : (
          <div className="space-y-2">
            {signedStats.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-700/40">
                <span className="font-mono text-xs text-gray-700 dark:text-gray-200">{key}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
