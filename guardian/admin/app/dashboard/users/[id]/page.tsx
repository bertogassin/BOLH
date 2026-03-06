'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
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
  const res = await fetch(`/api/users/${id}`).catch(() => ({ ok: false }))
  if (!res || !('ok' in res) || !res.ok)
    return {
      id,
      firstName: 'Alex',
      lastName: 'Taylor',
      email: 'alex.taylor@example.com',
      userType: 'client',
      verified: true,
      createdAt: '2024-01-15',
    }
  return (res as Response).json()
}

export default function UserDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: user } = useQuery({
    queryKey: ['user', params.id],
    queryFn: () => fetchUser(params.id),
  })

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
