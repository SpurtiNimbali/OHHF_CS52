import { useState } from 'react'

import type { GlossaryTermRow } from '../../types/glossary'
import { glossaryFullText, glossaryShortText, normalizeGlossaryCategories } from '../../types/glossary'
import { CARDEA_BORDER_SOFT, CARDEA_MUTED, CARDEA_NAVY, CARDEA_RADIUS_CARD } from '../../ui/cardeaTokens'
import { CategoryBadge } from './categoryBadge'

type GlossaryTermCardProps = {
  row: GlossaryTermRow
}

export function GlossaryTermCard({ row }: GlossaryTermCardProps) {
  const [expanded, setExpanded] = useState(false)
  const categories = normalizeGlossaryCategories(row.categories)
  const shortText = glossaryShortText(row)
  const fullText = glossaryFullText(row)
  const canExpand = Boolean(fullText && fullText !== shortText)

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
      <h3
        style={{
          fontSize: '1.0625rem',
          fontWeight: 700,
          color: CARDEA_NAVY,
          margin: '0 0 10px',
          lineHeight: 1.35,
        }}
      >
        {row.term}
      </h3>

      {categories.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
          }}
        >
          {categories.map((category) => (
            <CategoryBadge key={category} variant="glossary">
              {category}
            </CategoryBadge>
          ))}
        </div>
      )}

      {shortText ? (
        <p
          style={{
            color: CARDEA_MUTED,
            fontSize: '0.9375rem',
            lineHeight: 1.7,
            margin: '0 0 10px',
          }}
        >
          {expanded && canExpand ? fullText : shortText}
        </p>
      ) : (
        <p style={{ color: CARDEA_MUTED, fontSize: '0.9375rem', margin: '0 0 10px', fontStyle: 'italic' }}>
          Definition coming soon.
        </p>
      )}

      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            margin: '0 0 12px',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: CARDEA_NAVY,
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          {expanded ? 'Show shorter summary' : 'Read full definition'}
        </button>
      )}
    </article>
  )
}
