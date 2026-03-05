'use client'

import { useState } from 'react'
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

const defaultOrdersByDay = [
  { date: '01.06', created: 12, completed: 10 },
  { date: '05.06', created: 18, completed: 20 },
  { date: '10.06', created: 25, completed: 22 },
  { date: '15.06', created: 30, completed: 28 },
]
const defaultUserDistribution = [
  { name: 'Клиенты', value: 450 },
  { name: 'Охранники', value: 280 },
  { name: 'Агентства', value: 70 },
]
const defaultRevenueByMonth = [
  { month: 'Янв', revenue: 12000 },
  { month: 'Фев', revenue: 15000 },
  { month: 'Мар', revenue: 18000 },
  { month: 'Апр', revenue: 22000 },
  { month: 'Май', revenue: 25000 },
  { month: 'Июн', revenue: 28000 },
]
const defaultTopLocations = [
  { city: 'Москва', orders: 1200, growth: 15 },
  { city: 'Санкт-Петербург', orders: 450, growth: 8 },
  { city: 'Казань', orders: 180, growth: 22 },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d')
  const analytics = {
    ordersByDay: defaultOrdersByDay,
    userDistribution: defaultUserDistribution,
    revenueByMonth: defaultRevenueByMonth,
    topLocations: defaultTopLocations,
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Аналитика</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-[180px] rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="7d">7 дней</option>
          <option value="30d">30 дней</option>
          <option value="90d">3 месяца</option>
          <option value="365d">Год</option>
        </select>
      </div>

      <div className="rounded-lg border bg-white p-6 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold">Динамика заказов</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.ordersByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" stroke="#0055FF" name="Создано" />
              <Line type="monotone" dataKey="completed" stroke="#00C48C" name="Завершено" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-6 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold">Типы пользователей</h3>
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
          <h3 className="mb-4 text-lg font-semibold">Выручка по месяцам</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#0055FF" name="Выручка" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold">Топ локаций</h3>
        <div className="space-y-4">
          {analytics.topLocations.map((location, index) => (
            <div key={location.city} className="flex items-center">
              <span className="w-8 font-medium">{index + 1}.</span>
              <span className="flex-1">{location.city}</span>
              <span className="font-medium">{location.orders} заказов</span>
              <span className="ml-4 w-32 text-right text-green-600">
                +{location.growth}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
