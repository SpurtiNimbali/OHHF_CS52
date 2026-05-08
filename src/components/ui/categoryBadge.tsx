import type { CSSProperties, ReactNode } from 'react'

import { cardeaCategoryBadgeGlossary, cardeaCategoryBadgeSupport } from '../../ui/cardeaTokens'

type CategoryBadgeVariant = 'support' | 'glossary'

type CategoryBadgeProps = {
  children: ReactNode
  variant: CategoryBadgeVariant
  style?: CSSProperties
}

/** Category / topic pill shared by support resources & glossary tiles. */
export function CategoryBadge({ children, variant, style }: CategoryBadgeProps) {
  const base = variant === 'glossary' ? cardeaCategoryBadgeGlossary : cardeaCategoryBadgeSupport
  return <span style={{ ...base, ...style }}>{children}</span>
}
