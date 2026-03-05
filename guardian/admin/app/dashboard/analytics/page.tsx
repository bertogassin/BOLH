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
  { name: 'Clients', value: 450 },
  { name: 'Guards', value: 280 },
  { name: 'Agencies', value: 70 },
]
const defaultRevenueByMonth = [
  { month: 'Jan', revenue: 12000 },
  { month: 'Feb', revenue: 15000 },
  { month: 'Mar', revenue: 18000 },
  { month: 'Apr', revenue: 22000 },
  { month: 'May', revenue: 25000 },
  { month: 'Jun', revenue: 28000 },
]
const defaultTopLocations = [
  { city: 'Moscow', orders: 1200, growth: 15 },
  { city: 'Saint Petersburg', orders: 450, growth: 8 },
  { city: 'Kazan', orders: 180, growth: 22 },
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
        <h3 className="mb-4 text-lg font-semibold">Top locations</h3>
        <div className="space-y-4">
          {analytics.topLocations.map((location, index) => (
            <div key={location.city} className="flex items-center">
              <span className="w-8 font-medium">{index + 1}.</span>
              <span className="flex-1">{location.city}</span>
              <span className="font-medium">{location.orders} orders</span>
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
