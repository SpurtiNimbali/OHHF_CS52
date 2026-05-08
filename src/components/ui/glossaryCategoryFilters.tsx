import { CARDEA_FONT_SANS, CARDEA_NAVY } from '../../ui/cardeaTokens'
import { SectionEyebrow } from './sectionEyebrow'

const pillInactive = {
  padding: '10px 18px',
  borderRadius: 999,
  border: '1px solid rgba(25, 43, 63, 0.12)',
  background: '#ffffff',
  color: CARDEA_NAVY,
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: CARDEA_FONT_SANS,
  transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
} as const

const pillActive = {
  ...pillInactive,
  border: 'none',
  background: CARDEA_NAVY,
  color: '#ffffff',
} as const

type GlossaryCategoryFiltersProps = {
  categories: readonly string[]
  selectedTag: string | null
  onSelectTag: (tag: string | null) => void
}

/** Glossary taxonomy pills + “All”. */
export function GlossaryCategoryFilters({
  categories,
  selectedTag,
  onSelectTag,
}: GlossaryCategoryFiltersProps) {
  return (
    <section style={{ padding: '28px 0 8px' }}>
      <SectionEyebrow
        style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          margin: '0 0 14px',
        }}
      >
        Filter by category:
      </SectionEyebrow>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <button type="button" onClick={() => onSelectTag(null)} style={selectedTag === null ? pillActive : pillInactive}>
          All
        </button>
        {categories.map((cat) => {
          const isSelected = selectedTag === cat
          return (
            <button
              type="button"
              key={cat}
              onClick={() => onSelectTag(isSelected ? null : cat)}
              style={{
                ...(isSelected ? pillActive : pillInactive),
                textTransform: 'capitalize',
              }}
            >
              {cat}
            </button>
          )
        })}
      </div>
    </section>
  )
}
