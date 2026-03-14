'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  userType: string
  verified: boolean
  createdAt: string
}

async function fetchUser(id: string): Promise<User | null> {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || 'Failed to load user')
  }
  return res.json()
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  const userId = typeof params?.id === 'string' ? params.id : ''
  const { data: user, error, isFetching, refetch } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    enabled: Boolean(userId),
  })

  if (error) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load user'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          {isFetching ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    )
  }

  if (!user) return <div className="p-6">Loading...</div>

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/users"
            className="rounded-lg border p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-3xl font-bold">
            {user.firstName} {user.lastName}
          </h1>
          <span
            className={`rounded-full px-2 py-1 text-xs ${
              user.userType === 'client'
                ? 'bg-guardian-blue/10 text-guardian-blue'
                : user.userType === 'guard'
                ? 'bg-purple-500/10 text-purple-600'
                : 'bg-gray-500/10'
            }`}
          >
            {user.userType === 'client'
              ? 'Client'
              : user.userType === 'guard'
              ? 'Guard'
              : 'Agency'}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border px-4 py-2 text-sm">
            Verify
          </button>
          <button className="rounded-lg border border-red-500 px-4 py-2 text-sm text-red-600">
            Block
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Email</dt>
            <dd>{user.email}</dd>
          </div>
          {user.phone && (
            <div>
              <dt className="text-sm text-gray-500">Phone</dt>
              <dd>{user.phone}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-500">Status</dt>
            <dd>
              {user.verified ? (
                <span className="text-green-600">Verified</span>
              ) : (
                <span className="text-amber-600">Unverified</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Registered</dt>
            <dd>{new Date(user.createdAt).toLocaleDateString('en-US')}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border bg-white p-6 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold">Orders</h2>
        <p className="text-sm text-gray-500">User order list</p>
      </div>

      <div className="rounded-lg border bg-white p-6 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold">Payments</h2>
        <p className="text-sm text-gray-500">Payment history</p>
      </div>
    </div>
  )
}
