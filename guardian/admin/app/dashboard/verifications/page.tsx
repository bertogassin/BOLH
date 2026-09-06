'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

type Verification = {
  id: string
  user_id: string
  status: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  userType: string
  verified: boolean
}

async function fetchVerifications(): Promise<Verification[]> {
  const res = await fetch('/api/verifications', {
    cache: 'no-store',
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ||
        'Failed to load verifications'
    )
  }

  return Array.isArray(data.requests) ? data.requests : []
}

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users?search=&filter=all', {
    cache: 'no-store',
  })

  if (!res.ok) {
    return []
  }

  const data = await res.json().catch(() => [])
  return Array.isArray(data) ? data : []
}

export default function VerificationsPage() {
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<Verification | null>(null)
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState('')

  const {
    data: requests = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['admin-verifications'],
    queryFn: fetchVerifications,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-for-verification'],
    queryFn: fetchUsers,
  })

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
    }
  }, [requests])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return requests.filter((request) => {
      if (filter !== 'all' && request.status !== filter) {
        return false
      }

      if (!needle) {
        return true
      }

      const user = usersById.get(request.user_id)
      const haystack = [
        request.id,
        request.user_id,
        request.status,
        user?.firstName,
        user?.lastName,
        user?.email,
        user?.userType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [requests, filter, search, usersById])

  async function approve(request: Verification) {
    if (
      !window.confirm(
        'Approve this identity verification and mark the user as verified?'
      )
    ) {
      return
    }

    setBusyId(request.id)
    setActionError('')

    try {
      const res = await fetch(
        `/api/verifications/${encodeURIComponent(request.id)}/approve`,
        { method: 'POST' }
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ||
            'Verification approval failed'
        )
      }

      await refetch()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Verification approval failed'
      )
    } finally {
      setBusyId(null)
    }
  }

  async function reject() {
    if (!rejecting) return

    const cleanReason = reason.trim()

    if (cleanReason.length < 3 || cleanReason.length > 500) {
      setActionError(
        'Rejection reason must contain between 3 and 500 characters.'
      )
      return
    }

    setBusyId(rejecting.id)
    setActionError('')

    try {
      const res = await fetch(
        `/api/verifications/${encodeURIComponent(rejecting.id)}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: cleanReason }),
        }
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ||
            'Verification rejection failed'
        )
      }

      setRejecting(null)
      setReason('')
      await refetch()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Verification rejection failed'
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-guardian-blue" />
            <h1 className="text-3xl font-bold">Verifications</h1>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Review identity evidence before granting verified status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending"
          value={counts.pending}
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          title="Approved"
          value={counts.approved}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          title="Rejected"
          value={counts.rejected}
          icon={<XCircle className="h-5 w-5" />}
        />
        <StatCard
          title="Total"
          value={counts.all}
          icon={<FileCheck2 className="h-5 w-5" />}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-900 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, email or verification ID..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 dark:border-gray-700 dark:bg-gray-800"
          />
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="pending">Pending ({counts.pending})</option>
          <option value="approved">Approved ({counts.approved})</option>
          <option value="rejected">Rejected ({counts.rejected})</option>
          <option value="all">All ({counts.all})</option>
        </select>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {actionError}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-white dark:border-gray-700 dark:bg-gray-900">
        {error ? (
          <div className="p-6">
            <p className="text-red-600">
              {error instanceof Error
                ? error.message
                : 'Failed to load verifications'}
            </p>
          </div>
        ) : isLoading ? (
          <div className="p-6 text-sm text-gray-500">
            Loading verification queue...
          </div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="font-medium">No verification requests found.</p>
            <p className="mt-1 text-sm text-gray-500">
              New submissions will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-800">
            {visible.map((request) => {
              const user = usersById.get(request.user_id)
              const isPending = request.status === 'pending'
              const busy = busyId === request.id

              return (
                <div
                  key={request.id}
                  className="space-y-4 p-5 lg:flex lg:items-center lg:justify-between lg:space-y-0"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={request.status} />

                      {user?.verified && (
                        <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600">
                          User verified
                        </span>
                      )}

                      {user?.userType && (
                        <span className="rounded-full border px-2 py-1 text-xs">
                          {user.userType}
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold">
                        {user
                          ? `${user.firstName} ${user.lastName}`.trim() ||
                            'Unnamed user'
                          : `User ${request.user_id}`}
                      </p>

                      {user?.email && (
                        <p className="text-sm text-gray-500">
                          {user.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1 text-xs text-gray-500">
                      <p>Verification: {request.id}</p>
                      <p>User ID: {request.user_id}</p>
                      <p>
                        Submitted:{' '}
                        {request.created_at
                          ? new Date(request.created_at).toLocaleString()
                          : '—'}
                      </p>
                    </div>

                    {request.rejection_reason && (
                      <div className="max-w-2xl rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                        <strong>Rejection reason:</strong>{' '}
                        {request.rejection_reason}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/api/verifications/${encodeURIComponent(
                        request.id
                      )}/artifact`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      <Eye className="h-4 w-4" />
                      View document
                    </a>

                    {isPending && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => approve(request)}
                          className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setRejecting(request)
                            setReason('')
                            setActionError('')
                          }}
                          className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="text-xl font-bold">Reject verification</h2>

            <p className="mt-2 text-sm text-gray-500">
              Give the user a clear reason so they know what must be corrected.
            </p>

            <textarea
              autoFocus
              rows={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Example: Document image is unreadable. Please upload a clearer photo."
              className="mt-4 w-full rounded-lg border border-gray-300 p-3 dark:border-gray-700 dark:bg-gray-800"
            />

            <div className="mt-1 text-right text-xs text-gray-500">
              {reason.length}/500
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejecting(null)
                  setReason('')
                }}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={busyId === rejecting.id}
                onClick={reject}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Confirm rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between text-gray-500">
        <span className="text-sm">{title}</span>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return (
      <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600">
        Approved
      </span>
    )
  }

  if (status === 'rejected') {
    return (
      <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600">
        Rejected
      </span>
    )
  }

  return (
    <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-400">
      Pending review
    </span>
  )
}
