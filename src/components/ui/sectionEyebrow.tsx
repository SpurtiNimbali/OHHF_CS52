import type { CSSProperties, ReactNode } from 'react'

import { CARDEA_MUTED } from '../../ui/cardeaTokens'

type SectionEyebrowProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** Small uppercase / section label in muted Cardea green. */
export function SectionEyebrow({ children, className, style }: SectionEyebrowProps) {
  return (
    <p
      className={className}
      style={{
        color: CARDEA_MUTED,
        ...style,
      }}
    >
      {children}
    </p>
  )
}
