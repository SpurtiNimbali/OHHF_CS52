import type { ReactNode } from 'react'

import { CARDEA_LIGHT_BLUE, CARDEA_MUTED } from '../../ui/cardeaTokens'

/** Dashed panel for empty secondary lists (e.g. saved questions). */
export function DashedEmptyNotice({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl border border-dashed bg-white/70 py-12 text-center"
      style={{ borderColor: CARDEA_LIGHT_BLUE }}
    >
      <p className="text-sm" style={{ color: CARDEA_MUTED }}>
        {children}
      </p>
    </div>
  )
}
