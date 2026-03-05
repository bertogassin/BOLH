'use client'

import { useApiHealth } from '@/context/ApiHealthContext'

export function ApiHealthBanner() {
  const { apiAvailable } = useApiHealth()
  if (apiAvailable !== false) return null
  return (
    <div className="bg-red-600/90 text-white text-center py-2 px-4 text-sm z-50 relative">
      Сервер недоступен. Запустите API Gateway на порту 8080.
    </div>
  )
}
