import { useEffect, useMemo, useState } from 'react'

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
  GLOSSARY_CATEGORIES,
  GLOSSARY_SELECT,
  normalizeGlossaryCategories,
  termMatchesCategory,
  termMatchesSearch,
  type GlossaryTermRow,
} from '../types/glossary'
import {
  CARDEA_ALMOST_WHITE,
  CARDEA_BORDER_SOFT,
  CARDEA_FONT_SANS,
  CARDEA_MUTED,
  CARDEA_NAVY,
  CARDEA_RADIUS_CARD,
} from '../ui/cardeaTokens'

type RawGlossaryRow = {
  id: string | number
  term: string
  slug?: string | null
  aliases?: unknown
  categories?: unknown
  short_definition?: string | null
  full_definition?: string | null
}

function mapRow(raw: RawGlossaryRow): GlossaryTermRow {
  return {
    id: raw.id,
    term: raw.term,
    slug: raw.slug ?? null,
    aliases: raw.aliases ?? null,
    categories: normalizeGlossaryCategories(raw.categories),
    short_definition: raw.short_definition ?? null,
    full_definition: raw.full_definition ?? null,
  }
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [terms, setTerms] = useState<GlossaryTermRow[]>([])
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
        const { data, error: dbError } = await supabase
          .from('glossary_terms')
          .select(GLOSSARY_SELECT)
          .order('term', { ascending: true })

        if (dbError) {
          throw new Error(dbError.message)
        }

        if (isMounted) {
          setTerms((data as RawGlossaryRow[] | null)?.map(mapRow) ?? [])
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
  }, [refreshNonce])

  const filteredTerms = useMemo(() => {
    return terms.filter(
      (row) => termMatchesSearch(row, query) && termMatchesCategory(row, selectedCategory),
    )
  }, [terms, query, selectedCategory])

  const availableCategories = useMemo(() => {
    const seen = new Set<string>()
    for (const row of terms) {
      for (const cat of normalizeGlossaryCategories(row.categories)) {
        seen.add(cat)
      }
    }
    return GLOSSARY_CATEGORIES.filter((cat) => seen.has(cat))
  }, [terms])

  const filterCategories =
    availableCategories.length > 0 ? availableCategories : [...GLOSSARY_CATEGORIES]

  return (
    <div>
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
            <p
              style={{
                margin: '0 0 12px',
                fontSize: '0.8125rem',
                color: CARDEA_MUTED,
                maxWidth: 800,
              }}
            >
              Search by term name, acronym, or alternative names.
            </p>
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
                placeholder="Search terms, acronyms, or aliases..."
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
            categories={filterCategories}
            selectedTag={selectedCategory}
            onSelectTag={setSelectedCategory}
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
                title="No glossary terms yet"
                description="Terms will appear here once they are added to the database."
              />
            )}

            {!loading && !error && terms.length > 0 && filteredTerms.length === 0 && (
              <ResourcesPageEmpty
                title={
                  selectedCategory
                    ? `No ${selectedCategory} terms match`
                    : 'No terms match your search'
                }
                description={
                  selectedCategory
                    ? 'Try a different category or search term'
                    : 'Try a different search term or clear your filters'
                }
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
                {filteredTerms.map((row) => (
                  <GlossaryTermCard key={row.id} row={row} />
                ))}
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
                {selectedCategory
                  ? `Showing ${filteredTerms.length} ${selectedCategory} term${filteredTerms.length !== 1 ? 's' : ''}`
                  : `Showing ${filteredTerms.length} of ${terms.length} term${terms.length !== 1 ? 's' : ''}`}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default MedicalGlossary
