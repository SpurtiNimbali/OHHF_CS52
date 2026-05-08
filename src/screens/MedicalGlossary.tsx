import { useEffect, useState } from 'react'

import {
  ResourcesPageLoading,
  ResourcesPageError,
  ResourcesPageEmpty,
} from '../components/ResourcesPageStates'
import { GlossaryCategoryFilters } from '../components/ui/glossaryCategoryFilters'
import { GlossaryScreenHeading } from '../components/ui/glossaryScreenHeading'
import { GlossaryTermCard } from '../components/ui/glossaryTermCard'
import { supabase } from '../lib/supabase'
import {
  CARDEA_ALMOST_WHITE,
  CARDEA_BORDER_SOFT,
  CARDEA_FONT_SANS,
  CARDEA_MUTED,
  CARDEA_NAVY,
  CARDEA_RADIUS_CARD,
} from '../ui/cardeaTokens'

interface GlossaryTerm {
  id: string | number
  term: string
  definition: string
  category?: string
}

const CATEGORY_ORDER = [
  'anatomy',
  'condition',
  'treatment',
  'medication',
  'procedure',
  'general',
] as const

type CategorySlug = (typeof CATEGORY_ORDER)[number]

function formatCategoryLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

function getCategory(term: string): CategorySlug {
  const lower = term.toLowerCase()
  if (
    lower.includes('heart') ||
    lower.includes('artery') ||
    lower.includes('bone') ||
    lower.includes('muscle')
  ) {
    return 'anatomy'
  }
  if (
    lower.includes('syndrome') ||
    lower.includes('disease') ||
    lower.includes('disorder') ||
    lower.includes('condition')
  ) {
    return 'condition'
  }
  if (
    lower.includes('therapy') ||
    lower.includes('treatment') ||
    lower.includes('surgery')
  ) {
    return 'treatment'
  }
  if (
    lower.includes('pill') ||
    lower.includes('medication') ||
    lower.includes('drug') ||
    lower.includes('injection')
  ) {
    return 'medication'
  }
  if (
    lower.includes('procedure') ||
    lower.includes('test') ||
    lower.includes('scan') ||
    lower.includes('examination')
  ) {
    return 'procedure'
  }
  return 'general'
}

function BookSearchIcon({ color }: { color: string }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21V7l-8-3v15c0 .5.5 1 1 .8l7-3" />
      <path d="M12 7l8-3v15c0 .5-.5 1-1 .8l-7-3" />
      <path d="M12 7v13" />
    </svg>
  )
}

function MedicalGlossary() {
  const [query, setQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [terms, setTerms] = useState<GlossaryTerm[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function fetchTerms() {
      if (isMounted) {
        setLoading(true)
        setError(null)
      }

      try {
        const search = query.trim()

        let dbQuery = supabase
          .from('glossary_terms')
          .select('id, term, definition')
          .order('term', { ascending: true })

        if (search) {
          dbQuery = dbQuery.ilike('term', `%${search}%`)
        }

        const { data, error: dbError } = await dbQuery

        if (dbError) {
          throw new Error(dbError.message)
        }

        if (isMounted) {
          setTerms(data || [])
        }
      } catch (err) {
        if (isMounted) {
          setTerms([])
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load glossary terms. Check your Supabase configuration.',
          )
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchTerms()

    return () => {
      isMounted = false
    }
  }, [query, refreshNonce])

  const filteredTerms = terms.filter((t) => !selectedTag || getCategory(t.term) === selectedTag)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: CARDEA_ALMOST_WHITE,
        padding: '0 0 56px',
        fontFamily: CARDEA_FONT_SANS,
        color: CARDEA_NAVY,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 24px 0',
        }}
      >
        <GlossaryScreenHeading title="Medical Glossary" subtitle="Learn and understand common medical terms" />

        <section
          style={{
            background: 'rgba(172, 183, 168, 0.22)',
            marginLeft: '-24px',
            marginRight: '-24px',
            padding: '28px 24px',
            borderRadius: 16,
          }}
        >
          <div style={{ position: 'relative', maxWidth: 800 }}>
            <span
              style={{
                position: 'absolute',
                left: 18,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                pointerEvents: 'none',
              }}
            >
              <BookSearchIcon color={`${CARDEA_NAVY}45`} />
            </span>
            <input
              id="glossary-search"
              type="search"
              aria-label="Search medical terms"
              placeholder="Search medical terms..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                padding: '16px 16px 16px 52px',
                width: '100%',
                fontSize: '1rem',
                border: `1px solid ${CARDEA_BORDER_SOFT}`,
                borderRadius: CARDEA_RADIUS_CARD,
                outline: 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                background: '#ffffff',
                boxSizing: 'border-box',
                fontFamily: CARDEA_FONT_SANS,
                color: CARDEA_NAVY,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = CARDEA_NAVY
                e.target.style.boxShadow = `0 0 0 3px rgba(198, 217, 229, 0.65)`
              }}
              onBlur={(e) => {
                e.target.style.borderColor = CARDEA_BORDER_SOFT
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
        </section>

        <GlossaryCategoryFilters
          categories={CATEGORY_ORDER}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
        />

        <section style={{ paddingTop: 28 }}>
          {loading && <ResourcesPageLoading label="Loading terms…" />}

          {!loading && error && (
            <ResourcesPageError
              message={error}
              onRetry={() => setRefreshNonce((n) => n + 1)}
            />
          )}

          {!loading && !error && terms.length === 0 && (
            <ResourcesPageEmpty
              title={
                selectedTag ? `No ${formatCategoryLabel(selectedTag)} terms found` : 'No terms match your search'
              }
              description={
                selectedTag ? 'Try a different category or search term' : 'Try a different search term'
              }
            />
          )}

          {!loading &&
            !error &&
            terms.length > 0 &&
            filteredTerms.length === 0 &&
            selectedTag && (
              <ResourcesPageEmpty
                title={`No ${formatCategoryLabel(selectedTag)} terms found`}
                description="Try a different category or search term"
              />
            )}

          {!loading && !error && filteredTerms.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
                gap: 20,
              }}
            >
              {filteredTerms.map((term) => {
                const category = getCategory(term.term)
                return (
                  <GlossaryTermCard
                    key={term.id}
                    term={term.term}
                    definition={term.definition}
                    categoryLabel={category}
                  />
                )
              })}
            </div>
          )}

          {!loading && !error && terms.length > 0 && (
            <p
              style={{
                textAlign: 'center',
                color: CARDEA_MUTED,
                marginTop: 36,
                fontSize: '0.875rem',
              }}
            >
              {selectedTag
                ? `Showing ${filteredTerms.length} ${formatCategoryLabel(selectedTag)} term${filteredTerms.length !== 1 ? 's' : ''}`
                : `Showing ${terms.length} term${terms.length !== 1 ? 's' : ''}`}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

export default MedicalGlossary
