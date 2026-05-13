import type { ReactNode } from 'react'

import { CARDEA_NAVY } from '../../ui/cardeaTokens'

type InlineAlertBannerProps = {
  children: ReactNode
  className?: string
}

export function InlineAlertBanner({
  children,
  className = 'mx-3 mt-4 rounded-xl border bg-white px-4 py-3 text-sm sm:mx-4',
}: InlineAlertBannerProps) {
  return (
    <div role="alert" className={className} style={{ borderColor: 'rgba(25, 43, 63, 0.15)', color: CARDEA_NAVY }}>
      {children}
    </div>
  )
}
