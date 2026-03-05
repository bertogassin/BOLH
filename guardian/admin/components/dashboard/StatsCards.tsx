'use client'

import { motion } from 'framer-motion'
import { Users, ShieldCheck, DollarSign, CheckCircle } from 'lucide-react'

export interface StatsCardsProps {
  stats: {
    totalUsers: number
    activeOrders: number
    totalMatches: number
    revenue: number
    growth: {
      users: number
      orders: number
      matches: number
      revenue: number
    }
  }
}

const cards = [
  {
    key: 'users',
    title: 'Всего пользователей',
    valueKey: 'totalUsers' as const,
    growthKey: 'users' as const,
    icon: Users,
    color: 'bg-blue-500',
  },
  {
    key: 'orders',
    title: 'Активные заказы',
    valueKey: 'activeOrders' as const,
    growthKey: 'orders' as const,
    icon: ShieldCheck,
    color: 'bg-green-500',
  },
  {
    key: 'matches',
    title: 'Завершенные матчи',
    valueKey: 'totalMatches' as const,
    growthKey: 'matches' as const,
    icon: CheckCircle,
    color: 'bg-purple-500',
  },
  {
    key: 'revenue',
    title: 'Выручка (мес)',
    valueKey: 'revenue' as const,
    growthKey: 'revenue' as const,
    icon: DollarSign,
    color: 'bg-yellow-500',
    format: (v: number) => `$${v.toLocaleString()}`,
  },
]

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const value = stats[card.valueKey]
        const growth = stats.growth[card.growthKey]
        const displayValue =
          card.format && card.valueKey === 'revenue'
            ? card.format(value)
            : value.toLocaleString()
        const Icon = card.icon
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {card.title}
                </p>
                <p className="mt-2 text-3xl font-bold">{displayValue}</p>
                <p className="mt-2 text-sm text-green-600">
                  +{growth}% за месяц
                </p>
              </div>
              <div
                className={`rounded-lg ${card.color} p-3 text-white`}
              >
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
