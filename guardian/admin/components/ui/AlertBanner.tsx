'use client'

export interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
}

export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null
  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-lg border p-4 ${
            alert.severity === 'critical'
              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : alert.severity === 'warning'
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
              : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          }`}
        >
          <p className="font-medium">{alert.title}</p>
          <p className="text-sm opacity-90">{alert.message}</p>
        </div>
      ))}
    </div>
  )
}
