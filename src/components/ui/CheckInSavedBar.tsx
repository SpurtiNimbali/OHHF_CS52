import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { CARDEA_DARK_GREEN, CARDEA_FONT_PRIMARY } from '../../ui/cardeaTokens'
import { CHECKIN_SAVED_EVENT } from '../../lib/moodEntries'

const BAR_DURATION_MS = 2600

function CheckInSavedBar({ visible }: { visible: boolean }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] flex justify-center px-4 pt-3"
    >
      <div
        className="flex items-center gap-2.5 rounded-full px-4 py-2.5 shadow-lg transition-all duration-300 ease-out"
        style={{
          fontFamily: CARDEA_FONT_PRIMARY,
          background: CARDEA_DARK_GREEN,
          color: '#fff',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-120%)',
        }}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20"
          aria-hidden
        >
          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
        </span>
        <span className="text-sm font-semibold tracking-[0.01em]">Check-in saved!</span>
      </div>
    </div>,
    document.body,
  )
}

export function CheckInSavedBarHost() {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  const show = useCallback(() => {
    window.clearTimeout(timerRef.current)
    setVisible(true)
    timerRef.current = window.setTimeout(() => setVisible(false), BAR_DURATION_MS)
  }, [])

  useEffect(() => {
    const onSaved = () => show()
    window.addEventListener(CHECKIN_SAVED_EVENT, onSaved)
    return () => {
      window.removeEventListener(CHECKIN_SAVED_EVENT, onSaved)
      window.clearTimeout(timerRef.current)
    }
  }, [show])

  return <CheckInSavedBar visible={visible} />
}
