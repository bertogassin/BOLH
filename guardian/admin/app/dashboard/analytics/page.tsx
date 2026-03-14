'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const COLORS = ['#0055FF', '#00C48C', '#FF9500', '#FF3B30', '#AF52DE']

type AdminUser = {
  id: string
  userType: string
}

type AdminOrder = {
  id: string
  status: string
  created_at: string
  budget_min?: number
  budget_max?: number
}

const PERIOD_TO_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    Promise.all([fetch('/api/users?filter=all'), fetch('/api/admin-orders')])
      .then(async ([usersRes, ordersRes]) => {
        if (!usersRes.ok) {
          const data = await usersRes.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error || 'Failed to load users')
        }
        if (!ordersRes.ok) {
          const data = await ordersRes.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error || 'Failed to load orders')
        }
        const rawUsers = (await usersRes.json()) as Array<{
          id: string
          userType: string
        }>
        const ordersPayload = (await ordersRes.json()) as { orders?: AdminOrder[] }
        if (!alive) return
        setUsers(Array.isArray(rawUsers) ? rawUsers : [])
        setOrders(Array.isArray(ordersPayload.orders) ? ordersPayload.orders : [])
      })
      .catch((err) => {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const analytics = useMemo(() => {
    const now = Date.now()
    const days = PERIOD_TO_DAYS[period] || 30
    const startTime = now - days * 24 * 60 * 60 * 1000
    const filteredOrders = orders.filter((o) => {
      const ts = new Date(o.created_at || 0).getTime()
      return Number.isFinite(ts) && ts >= startTime
    })

    const byDay = new Map<string, { created: number; completed: number }>()
    for (const order of filteredOrders) {
      const date = new Date(order.created_at)
      const key = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`
      const row = byDay.get(key) || { created: 0, completed: 0 }
      row.created += 1
      if (String(order.status || '').toLowerCase() === 'completed') row.completed += 1
      byDay.set(key, row)
    }
    const ordersByDay = Array.from(byDay.entries()).map(([date, row]) => ({
      date,
      created: row.created,
      completed: row.completed,
    }))

    const userDistribution = [
      { name: 'Clients', value: users.filter((u) => u.userType === 'client').length },
      { name: 'Guards', value: users.filter((u) => u.userType === 'guard').length },
      { name: 'Agencies', value: users.filter((u) => u.userType === 'agency').length },
    ]

    const monthlyRevenue = new Map<string, number>()
    for (const order of filteredOrders) {
      const date = new Date(order.created_at)
      const monthKey = date.toLocaleString('en-US', { month: 'short' })
      const avgBudget = (Number(order.budget_min || 0) + Number(order.budget_max || 0)) / 2
      monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + avgBudget)
    }
    const revenueByMonth = Array.from(monthlyRevenue.entries()).map(([month, revenue]) => ({
      month,
      revenue: Math.round(revenue),
    }))

    return {
      ordersByDay,
      userDistribution,
      revenueByMonth,
    }
  }, [orders, period, users])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-[180px] rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="90d">3 months</option>
          <option value="365d">1 year</option>
        </select>
      </div>

      <div className="rounded-lg border bg-white p-6 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold">Order trend</h3>
        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.ordersByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" stroke="#0055FF" name="Created" />
              <Line type="monotone" dataKey="completed" stroke="#00C48C" name="Completed" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {loading && <p className="mt-3 text-sm text-gray-500">Loading analytics...</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-6 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold">User types</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.userDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.userDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold">Revenue by month</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#0055FF" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold">Dataset health</h3>
        <div className="space-y-2 text-sm">
          <p>Total users: <span className="font-semibold">{users.length}</span></p>
          <p>Total orders in period: <span className="font-semibold">{analytics.ordersByDay.reduce((s, d) => s + d.created, 0)}</span></p>
          <p>Completed orders in period: <span className="font-semibold">{analytics.ordersByDay.reduce((s, d) => s + d.completed, 0)}</span></p>
        </div>
      </div>
    </div>
  )
}
