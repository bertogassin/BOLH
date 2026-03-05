'use client'

export interface OrderRow {
  id: string
  title: string
  status: string
  createdAt: string
}

export function RecentOrders({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold">Последние заказы</h3>
      <div className="space-y-3">
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500">Нет заказов</p>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 dark:border-gray-700"
            >
              <div>
                <p className="font-medium">{order.title}</p>
                <p className="text-xs text-gray-500">{order.createdAt}</p>
              </div>
              <span className="rounded-full bg-guardian-blue/10 px-2 py-1 text-xs font-medium text-guardian-blue">
                {order.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
