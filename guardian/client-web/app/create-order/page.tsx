'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Wallet, MapPin, Calendar, Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { createOrder } from '@/lib/api'
import { AppNav } from '@/components/AppNav'
import { InputWithClear } from '@/components/InputWithClear'

export default function CreateOrderPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [lat, setLat] = useState('48.8566')
  const [lon, setLon] = useState('2.3522')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [guardCount, setGuardCount] = useState('1')
  const minBudgetValue = Number.parseFloat(budgetMin)
  const maxBudgetValue = Number.parseFloat(budgetMax)
  const hasBudgetInputs = budgetMin.trim() !== '' && budgetMax.trim() !== ''
  const budgetRangeInvalid =
    hasBudgetInputs && Number.isFinite(minBudgetValue) && Number.isFinite(maxBudgetValue) && maxBudgetValue < minBudgetValue
  const startDateTime = startDate && startTime ? new Date(`${startDate}T${startTime}`) : null
  const endDateTime = endDate && endTime ? new Date(`${endDate}T${endTime}`) : null
  const invalidDateInput =
    (startDateTime !== null && Number.isNaN(startDateTime.getTime())) ||
    (endDateTime !== null && Number.isNaN(endDateTime.getTime()))
  const dateRangeInvalid =
    startDateTime !== null &&
    endDateTime !== null &&
    !Number.isNaN(startDateTime.getTime()) &&
    !Number.isNaN(endDateTime.getTime()) &&
    endDateTime.getTime() <= startDateTime.getTime()
  const submitDisabled = loading || budgetRangeInvalid || dateRangeInvalid || invalidDateInput

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      router.push('/login')
      router.refresh()
      return
    }
    const minB = Number.parseFloat(budgetMin)
    const maxB = Number.parseFloat(budgetMax)
    if (!Number.isFinite(minB) || !Number.isFinite(maxB)) {
      setError(t('create_order.error_budget'))
      return
    }
    if (maxB < minB) {
      setError(t('create_order.error_budget'))
      return
    }
    const start = new Date(`${startDate}T${startTime}`)
    const end = new Date(`${endDate}T${endTime}`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError(t('create_order.error_dates'))
      return
    }
    if (end.getTime() <= start.getTime()) {
      setError(t('create_order.error_dates'))
      return
    }
    setError('')
    setLoading(true)
    try {
      await createOrder({
        title,
        description: description || undefined,
        budget_min: minB,
        budget_max: maxB,
        latitude: parseFloat(lat) || 48.8566,
        longitude: parseFloat(lon) || 2.3522,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        guard_count: parseInt(guardCount, 10) || 1,
      })
      router.push('/orders')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('create_order.error_create'))
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  if (!user) {
    return (
      <div className="min-h-screen bg-guardian-bg p-4">
        <div className="card p-6 text-center text-gray-600">
          {t('create_order.login_required')}
          <Link href="/login" className="mt-4 block text-guardian-blue hover:underline">{t('auth.login_btn')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-guardian-bg pb-24">
      <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/95 backdrop-blur text-gray-900">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/" className="rounded-full p-2 hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">{t('create_order.new_order')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="card space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText className="h-4 w-4 text-guardian-blue" /> {t('create_order.title_label')}
            </p>
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">{t('create_order.title_label')} *</label>
              <InputWithClear
                value={title}
                onChange={setTitle}
                className="input-field"
                required
                placeholder={t('create_order.placeholder_title')}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-600">{t('create_order.description')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field min-h-[80px]"
                rows={3}
                placeholder={t('create_order.placeholder_description')}
              />
            </div>
          </div>

          <div className="card space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Wallet className="h-4 w-4 text-guardian-blue" /> {t('create_order.budget')}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t('create_order.budget_min')} *</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={budgetMin}
                  onChange={(e) => {
                    setBudgetMin(e.target.value)
                    if (error) setError('')
                  }}
                  className={`input-field ${budgetRangeInvalid ? 'border-red-400 focus:border-red-500' : ''}`}
                  required
                  aria-invalid={budgetRangeInvalid}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t('create_order.budget_max')} *</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={budgetMax}
                  onChange={(e) => {
                    setBudgetMax(e.target.value)
                    if (error) setError('')
                  }}
                  className={`input-field ${budgetRangeInvalid ? 'border-red-400 focus:border-red-500' : ''}`}
                  required
                  aria-invalid={budgetRangeInvalid}
                />
              </div>
            </div>
            {budgetRangeInvalid && (
              <p className="text-sm text-red-600">{t('create_order.error_budget')}</p>
            )}
          </div>

          <div className="card space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <MapPin className="h-4 w-4 text-guardian-blue" /> {t('create_order.location')}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t('create_order.lat')}</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t('create_order.lon')}</label>
                <input
                  type="number"
                  step="any"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Calendar className="h-4 w-4 text-guardian-blue" /> {t('create_order.time')}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t('create_order.start_date')} *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    if (error) setError('')
                  }}
                  min={today}
                  className={`input-field ${dateRangeInvalid || invalidDateInput ? 'border-red-400 focus:border-red-500' : ''}`}
                  required
                  aria-invalid={dateRangeInvalid || invalidDateInput}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t('create_order.start_time')} *</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value)
                    if (error) setError('')
                  }}
                  className={`input-field ${dateRangeInvalid || invalidDateInput ? 'border-red-400 focus:border-red-500' : ''}`}
                  required
                  aria-invalid={dateRangeInvalid || invalidDateInput}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t('create_order.end_date')} *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    if (error) setError('')
                  }}
                  min={startDate || today}
                  className={`input-field ${dateRangeInvalid || invalidDateInput ? 'border-red-400 focus:border-red-500' : ''}`}
                  required
                  aria-invalid={dateRangeInvalid || invalidDateInput}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t('create_order.end_time')} *</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value)
                    if (error) setError('')
                  }}
                  className={`input-field ${dateRangeInvalid || invalidDateInput ? 'border-red-400 focus:border-red-500' : ''}`}
                  required
                  aria-invalid={dateRangeInvalid || invalidDateInput}
                />
              </div>
            </div>
            {(dateRangeInvalid || invalidDateInput) && (
              <p className="text-sm text-red-600">{t('create_order.error_dates')}</p>
            )}
          </div>

          <div className="card">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Users className="h-4 w-4 text-guardian-blue" /> {t('create_order.guard_count')}
            </p>
            <input
              type="number"
              min="1"
              max="100"
              value={guardCount}
              onChange={(e) => setGuardCount(e.target.value)}
              className="input-field max-w-[120px]"
            />
          </div>

          <button type="submit" disabled={submitDisabled} className="btn-primary w-full py-3 text-base">
            {loading ? t('create_order.creating') : t('create_order.create_btn')}
          </button>
        </form>
      </main>

      <AppNav />
    </div>
  )
}
