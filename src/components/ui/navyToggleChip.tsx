import type { ReactNode } from 'react'

import { CARDEA_DARK_GREEN } from '../../ui/cardeaTokens'

type NavyToggleChipProps = {
  selected: boolean
  onClick: () => void
  children: ReactNode
}

const baseClass =
  'rounded-full border-2 px-3 py-1.5 text-left text-xs font-medium transition-colors sm:text-sm '
const offClass =
  'border-[rgba(25,43,63,0.15)] bg-white/90 text-[#192b3f] hover:border-[rgba(87,117,104,0.4)]'

/** Green filled vs outlined chip (visit context & custom tags on Questions screen). */
export function NavyToggleChip({ selected, onClick, children }: NavyToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass}${selected ? 'border-transparent text-white' : offClass}`}
      style={
        selected ? { background: CARDEA_DARK_GREEN, borderColor: CARDEA_DARK_GREEN } : undefined
      }
    >
      {children}
    </button>
  )
}
