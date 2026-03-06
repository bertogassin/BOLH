import { ChevronLeft, ChevronRight } from 'lucide-react'

const DEFAULT_PANEL_CLASS = 'rounded-xl bg-black border border-violet-400 flex items-center justify-between min-h-[62px] px-4 py-2.5'

type SelectorProps = {
  label: string
  value: string
  onPrev: () => void
  onNext: () => void
  disablePrev?: boolean
  disableNext?: boolean
  ariaLabelPrev?: string
  ariaLabelNext?: string
  panelClass?: string
}

export function Selector({
  label,
  value,
  onPrev,
  onNext,
  disablePrev,
  disableNext,
  ariaLabelPrev,
  ariaLabelNext,
  panelClass,
}: SelectorProps) {
  return (
    <div className={panelClass || DEFAULT_PANEL_CLASS}>
      <button type="button" onClick={onPrev} disabled={disablePrev} className="h-11 w-11 rounded-lg hover:bg-white/10 flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80" aria-label={ariaLabelPrev}><ChevronLeft className="h-4 w-4 text-white/80" /></button>
      <div className="text-center min-w-0 flex-1 leading-tight">
        <p className="text-xs uppercase text-white/70 truncate">{label}</p>
        <p className="mt-1 text-[17px] font-semibold truncate tabular-nums">{value}</p>
      </div>
      <button type="button" onClick={onNext} disabled={disableNext} className="h-11 w-11 rounded-lg hover:bg-white/10 flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80" aria-label={ariaLabelNext}><ChevronRight className="h-4 w-4 text-white/80" /></button>
    </div>
  )
}
