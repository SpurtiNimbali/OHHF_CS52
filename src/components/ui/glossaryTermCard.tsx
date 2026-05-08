import { CARDEA_BORDER_SOFT, CARDEA_MUTED, CARDEA_NAVY, CARDEA_RADIUS_CARD } from '../../ui/cardeaTokens'
import { CategoryBadge } from './categoryBadge'

type GlossaryTermCardProps = {
  term: string
  definition: string
  categoryLabel: string
}

export function GlossaryTermCard({ term, definition, categoryLabel }: GlossaryTermCardProps) {
  return (
    <article
      style={{
        background: '#ffffff',
        border: `1px solid ${CARDEA_BORDER_SOFT}`,
        borderRadius: CARDEA_RADIUS_CARD,
        padding: '22px 24px',
        boxShadow: '0 2px 12px rgba(25, 43, 63, 0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 12,
        }}
      >
        <h3
          style={{
            fontSize: '1.0625rem',
            fontWeight: 700,
            color: CARDEA_NAVY,
            margin: 0,
            lineHeight: 1.35,
          }}
        >
          {term}
        </h3>
        <CategoryBadge variant="glossary">{categoryLabel}</CategoryBadge>
      </div>
      <p
        style={{
          color: CARDEA_MUTED,
          fontSize: '0.9375rem',
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {definition}
      </p>
    </article>
  )
}
