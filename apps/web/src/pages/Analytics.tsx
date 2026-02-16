import { For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, Icon, Badge } from '@bolh/ui';

// Mock data for guard analytics
const stats = {
  totalEarnings: 450000,
  thisMonth: 125000,
  completedOrders: 45,
  rating: 4.8,
  totalReviews: 127,
  responseRate: 95,
  completionRate: 98,
  onTimeRate: 97,
};

const recentOrders = [
  { id: '1', service: 'Bodyguard', earnings: 16000, date: '2026-02-06', rating: 5 },
  { id: '2', service: 'Event Security', earnings: 48000, date: '2026-02-05', rating: 5 },
  { id: '3', service: 'Patrol', earnings: 9000, date: '2026-02-04', rating: 4 },
];

const weeklyEarnings = [
  { day: 'Mon', amount: 16000 },
  { day: 'Tue', amount: 24000 },
  { day: 'Wed', amount: 8000 },
  { day: 'Thu', amount: 32000 },
  { day: 'Fri', amount: 28000 },
  { day: 'Sat', amount: 12000 },
  { day: 'Sun', amount: 5000 },
];

const maxEarning = Math.max(...weeklyEarnings.map(d => d.amount));

export default function AnalyticsPage() {
  const navigate = useNavigate();

  return (
    <div class="px-4 py-6 pb-20">
      {/* Header */}
      <div class="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" size="md" />
        </button>
        <h1 class="text-xl font-bold text-gray-900">Analytics</h1>
      </div>

      {/* Earnings overview */}
      <Card class="bg-gradient-to-r from-green-600 to-green-700 text-white mb-6">
        <div class="text-center">
          <p class="text-sm opacity-80">Total Earnings</p>
          <p class="text-3xl font-bold">{stats.totalEarnings.toLocaleString()} ₸</p>
          <p class="text-sm opacity-80 mt-1">
            +{stats.thisMonth.toLocaleString()} ₸ this month
          </p>
        </div>
      </Card>

      {/* Stats grid */}
      <div class="grid grid-cols-2 gap-3 mb-6">
        <Card class="text-center">
          <Icon name="shield" size="lg" class="text-blue-500 mx-auto mb-2" />
          <p class="text-2xl font-bold text-gray-900">{stats.completedOrders}</p>
          <p class="text-xs text-gray-500">Completed Orders</p>
        </Card>
        <Card class="text-center">
          <Icon name="star" size="lg" class="text-yellow-500 mx-auto mb-2" />
          <p class="text-2xl font-bold text-gray-900">{stats.rating}</p>
          <p class="text-xs text-gray-500">{stats.totalReviews} Reviews</p>
        </Card>
        <Card class="text-center">
          <Icon name="check" size="lg" class="text-green-500 mx-auto mb-2" />
          <p class="text-2xl font-bold text-gray-900">{stats.completionRate}%</p>
          <p class="text-xs text-gray-500">Completion Rate</p>
        </Card>
        <Card class="text-center">
          <Icon name="arrowRight" size="lg" class="text-purple-500 mx-auto mb-2" />
          <p class="text-2xl font-bold text-gray-900">{stats.onTimeRate}%</p>
          <p class="text-xs text-gray-500">On-Time Rate</p>
        </Card>
      </div>

      {/* Weekly chart */}
      <Card title="This Week" class="mb-6">
        <div class="flex items-end justify-between h-32 gap-2">
          <For each={weeklyEarnings}>
            {(day) => (
              <div class="flex-1 flex flex-col items-center">
                <div 
                  class="w-full bg-blue-500 rounded-t transition-all duration-300"
                  style={{ height: `${(day.amount / maxEarning) * 100}%`, "min-height": "4px" }}
                />
                <p class="text-xs text-gray-500 mt-2">{day.day}</p>
              </div>
            )}
          </For>
        </div>
        <p class="text-center text-sm text-gray-500 mt-4">
          Weekly total: {weeklyEarnings.reduce((s, d) => s + d.amount, 0).toLocaleString()} ₸
        </p>
      </Card>

      {/* Recent orders */}
      <Card title="Recent Orders">
        <div class="space-y-3">
          <For each={recentOrders}>
            {(order) => (
              <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p class="font-medium text-gray-900">{order.service}</p>
                  <p class="text-xs text-gray-500">{order.date}</p>
                </div>
                <div class="text-right">
                  <p class="font-semibold text-green-600">+{order.earnings.toLocaleString()} ₸</p>
                  <div class="flex items-center gap-1 justify-end">
                    <Icon name="star" size="sm" class="text-yellow-400" />
                    <span class="text-xs text-gray-500">{order.rating}</span>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Card>
    </div>
  );
}
