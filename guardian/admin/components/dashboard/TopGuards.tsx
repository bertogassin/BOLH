'use client'

export interface GuardRow {
  id: string
  name: string
  rating: number
  completedOrders: number
}

export function TopGuards({ guards }: { guards: GuardRow[] }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold">Топ охранников</h3>
      <div className="space-y-3">
        {guards.length === 0 ? (
          <p className="text-sm text-gray-500">Нет данных</p>
        ) : (
          guards.map((g, i) => (
            <div
              key={g.id}
              className="flex items-center justify-between"
            >
              <span className="w-6 font-medium">{i + 1}.</span>
              <span className="flex-1">{g.name}</span>
              <span className="text-yellow-500">★ {g.rating}</span>
              <span className="text-sm text-gray-500">{g.completedOrders} зак.</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
