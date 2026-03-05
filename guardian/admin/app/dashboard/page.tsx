import { Metadata } from 'next'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { RecentOrders } from '@/components/dashboard/RecentOrders'
import { ActivityChart } from '@/components/dashboard/ActivityChart'
import { TopGuards } from '@/components/dashboard/TopGuards'
import { AlertBanner } from '@/components/ui/AlertBanner'

export const metadata: Metadata = {
  title: 'Dashboard | Guardian Admin',
}

async function getDashboardStats() {
  return {
    totalUsers: 12580,
    activeOrders: 342,
    totalMatches: 8940,
    revenue: 125000,
    growth: { users: 12, orders: 5, matches: 8, revenue: 15 },
    activity: [],
    topGuards: [
      { id: '1', name: 'Ivan Petrov', rating: 4.9, completedOrders: 124 },
      { id: '2', name: 'Alexey Sidorov', rating: 4.8, completedOrders: 98 },
      { id: '3', name: 'Dmitry Kozlov', rating: 4.8, completedOrders: 87 },
    ],
    recentOrders: [
      { id: '1', title: 'Event security', status: 'In progress', createdAt: '15.06.2024 20:00' },
      { id: '2', title: 'Night security', status: 'Matching', createdAt: '15.06.2024 18:30' },
      { id: '3', title: 'Conference', status: 'Completed', createdAt: '14.06.2024 22:00' },
    ],
    recentMatches: [] as { id: string; orderId: string; guardName: string }[],
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
