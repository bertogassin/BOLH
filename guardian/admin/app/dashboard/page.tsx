import { Metadata } from 'next'
import { cookies } from 'next/headers'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { RecentOrders } from '@/components/dashboard/RecentOrders'
import { ActivityChart } from '@/components/dashboard/ActivityChart'
import { TopGuards } from '@/components/dashboard/TopGuards'
import { AlertBanner } from '@/components/ui/AlertBanner'

export const metadata: Metadata = {
  title: 'Dashboard | Guardian Admin',
}

async function getDashboardStats() {
  const cookieStore = await cookies()
  const token = cookieStore.get('guardian_admin_token')?.value?.trim()
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

  const emptyStats = {
    totalUsers: 0,
    activeOrders: 0,
    totalMatches: 0,
    revenue: 0,
    growth: { users: 0, orders: 0, matches: 0, revenue: 0 },
    activity: [] as { date: string; created: number; completed: number }[],
    topGuards: [] as { id: string; name: string; rating: number; completedOrders: number }[],
    recentOrders: [] as { id: string; title: string; status: string; createdAt: string }[],
    recentMatches: [] as { id: string; orderId: string; guardName: string }[],
  }
  if (!token) return emptyStats

  try {
    const [ordersRes, usersRes] = await Promise.all([
      fetch(`${apiBase}/api/v1/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
      fetch(`${apiBase}/api/v1/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
    ])
    if (!ordersRes.ok) return emptyStats

    const ordersData = (await ordersRes.json()) as {
      orders?: Array<{
        id?: string
        title?: string
        status?: string
        created_at?: string
      }>
    }
    const usersData = usersRes.ok
      ? ((await usersRes.json()) as { users?: Array<{ id?: string }> })
      : { users: [] as Array<{ id?: string }> }
    const orders = Array.isArray(ordersData.orders) ? ordersData.orders : []
    const users = Array.isArray(usersData.users) ? usersData.users : []

    const activeStatuses = new Set(['published', 'searching', 'matched', 'in_progress'])
    const completedStatuses = new Set(['completed'])
    const activeOrders = orders.filter((o) => activeStatuses.has(String(o.status || '').toLowerCase())).length
    const totalMatches = orders.filter((o) => completedStatuses.has(String(o.status || '').toLowerCase())).length

    const byDay = new Map<string, { created: number; completed: number }>()
    for (const o of orders) {
      const date = new Date(String(o.created_at || new Date().toISOString()))
      const key = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`
      const current = byDay.get(key) || { created: 0, completed: 0 }
      current.created += 1
      if (completedStatuses.has(String(o.status || '').toLowerCase())) current.completed += 1
      byDay.set(key, current)
    }
    const activity = Array.from(byDay.entries())
      .slice(-7)
      .map(([date, v]) => ({ date, created: v.created, completed: v.completed }))

    const recentOrders = orders
      .slice()
      .sort((a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime())
      .slice(0, 6)
      .map((o) => ({
        id: String(o.id || ''),
        title: String(o.title || 'Order'),
        status: String(o.status || 'unknown'),
        createdAt: new Date(String(o.created_at || Date.now())).toLocaleString('en-US'),
      }))

    return {
      ...emptyStats,
      totalUsers: users.length,
      activeOrders,
      totalMatches,
      activity,
      recentOrders,
    }
  } catch {
    return emptyStats
  }
}

async function getActiveAlerts() {
  return [] as { id: string; severity: 'critical' | 'warning' | 'info'; title: string; message: string }[]
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()
  const alerts = await getActiveAlerts()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      <StatsCards
        stats={{
          totalUsers: stats.totalUsers,
          activeOrders: stats.activeOrders,
          totalMatches: stats.totalMatches,
          revenue: stats.revenue,
          growth: stats.growth,
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityChart data={stats.activity?.length ? stats.activity : undefined} />
        </div>
        <div>
          <TopGuards guards={stats.topGuards} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentOrders orders={stats.recentOrders} />
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold">Recent matches</h3>
          <p className="text-sm text-gray-500">No data</p>
        </div>
      </div>
    </div>
  )
}
