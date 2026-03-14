'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, MoreHorizontal } from 'lucide-react'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  userType: string
  verified: boolean
  blocked: boolean
  reputationScore: number
  completedOrders: number
  createdAt: string
  avatar?: string
}

async function fetchUsers(params: { search: string; filter: string }): Promise<User[]> {
  const res = await fetch(
    `/api/users?search=${encodeURIComponent(params.search)}&filter=${params.filter}`
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || 'Failed to load users')
  }
  return res.json()
}

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const { data: users = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['users', search, filter],
    queryFn: () => fetchUsers({ search, filter }),
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Users</h1>
        <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600">
          Export CSV
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            placeholder="Search by email, name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="all">All</option>
          <option value="client">Clients</option>
          <option value="guard">Guards</option>
          <option value="agency">Agencies</option>
          <option value="verified">Verified</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white dark:bg-gray-800">
        {error ? (
          <div className="space-y-3 p-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error instanceof Error ? error.message : 'Failed to load users'}
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
        ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="p-4 text-left text-sm font-medium">User</th>
              <th className="p-4 text-left text-sm font-medium">Type</th>
              <th className="p-4 text-left text-sm font-medium">Status</th>
              <th className="p-4 text-left text-sm font-medium">Rating</th>
              <th className="p-4 text-left text-sm font-medium">Orders</th>
              <th className="p-4 text-left text-sm font-medium">Registered</th>
              <th className="w-[50px] p-4"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-4 text-sm text-gray-500">
                  Loading users...
                </td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-sm text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="border-b dark:border-gray-700">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                      {user.firstName?.[0]}
                      {user.lastName?.[0]}
                    </div>
                    <div>
                      <Link
                        href={`/dashboard/users/${user.id}`}
                        className="font-medium hover:underline"
                      >
                        {user.firstName} {user.lastName}
                      </Link>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  {user.verified ? (
                    <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs text-green-600">
                      Verified
                    </span>
                  ) : user.blocked ? (
                    <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs text-red-600">
                      Blocked
                    </span>
                  ) : (
                    <span className="rounded-full border px-2 py-1 text-xs">
                      Unverified
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-yellow-500">★</span> {user.reputationScore}
                </TableCell>
                <TableCell>{user.completedOrders}</TableCell>
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString('en-US')}
                </TableCell>
                <TableCell>
                  <button className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  )
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="p-4">{children}</td>
}
