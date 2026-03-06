import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { minutesToTime, normalizeTime, sanitizeTimeDraft, timeToMinutes } from '@/lib/datetime/timeUtils'

const DEFAULT_PANEL_CLASS = 'rounded-xl bg-black border border-violet-400 flex items-center justify-between min-h-[62px] px-4 py-2.5'

type TimeSelectorProps = {
  label: string
  value: string
  onChange: (v: string) => void
  panelClass?: string
}

export function TimeSelector({ label, value, onChange, panelClass }: TimeSelectorProps) {
  const cur = /^\d{2}:\d{2}$/.test(value) ? value : '00:00'
  const curMinutes = timeToMinutes(cur)
  const prevMinutes = (curMinutes - 15 + 24 * 60) % (24 * 60)
  const nextMinutes = (curMinutes + 15) % (24 * 60)
  const [draft, setDraft] = useState(cur)

  useEffect(() => {
    setDraft(cur)
  }, [cur])

  return (
    <div className={panelClass || DEFAULT_PANEL_CLASS}>
      <button type="button" onClick={() => onChange(minutesToTime(prevMinutes))} className="h-11 w-11 rounded-lg hover:bg-white/10 flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80" aria-label="Previous time"><ChevronLeft className="h-4 w-4 text-white/80" /></button>
      <div className="text-center min-w-0 flex-1 leading-tight">
        <p className="h-3 flex items-center justify-center text-xs text-white/70">{label}</p>
        <input
          type="text"
          value={draft}
          inputMode="numeric"
          placeholder="00:00"
          onChange={(e) => {
            const nextDraft = sanitizeTimeDraft(e.target.value)
            setDraft(nextDraft)
            const normalized = normalizeTime(nextDraft)
            if (normalized) onChange(normalized)
          }}
          onBlur={() => {
            const normalized = normalizeTime(draft)
            setDraft(normalized ?? cur)
            if (normalized) onChange(normalized)
          }}
          className="mt-1 h-7 w-full bg-transparent text-center text-[17px] font-semibold tabular-nums tracking-wide outline-none"
        />
      </div>
      <button type="button" onClick={() => onChange(minutesToTime(nextMinutes))} className="h-11 w-11 rounded-lg hover:bg-white/10 flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80" aria-label="Next time"><ChevronRight className="h-4 w-4 text-white/80" /></button>
    </div>
  )
}
