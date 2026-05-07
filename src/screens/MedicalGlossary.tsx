import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface GlossaryTerm {
  id: string | number
  term: string
  definition: string
  category?: string
}

const NAVY = '#192b3f'
const ALMOST_WHITE = '#f5f9f9'
const LIGHT_GREEN = '#acb7a8'
const BORDER_SOFT = 'rgba(25, 43, 63, 0.1)'
const RADIUS = 14
const FONT_SANS =
  '\'Inter\', system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif'

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
              : 'Could not load glossary terms. Check your Supabase configuration.'
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
  }, [query])

  const filteredTerms = terms.filter((t) => !selectedTag || getCategory(t.term) === selectedTag)

  const pillInactive = {
    padding: '10px 18px',
    borderRadius: 999,
    border: '1px solid rgba(25, 43, 63, 0.12)',
    background: '#ffffff',
    color: NAVY,
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT_SANS,
    transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
  } as const

  const pillActive = {
    ...pillInactive,
    border: 'none',
    background: NAVY,
    color: '#ffffff',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: ALMOST_WHITE,
        padding: '0 0 56px',
        fontFamily: FONT_SANS,
        color: NAVY,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 24px 0',
        }}
      >
        <header style={{ padding: '8px 0 28px' }}>
          <h1
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 2rem)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: NAVY,
              margin: '0 0 12px',
              textTransform: 'uppercase',
            }}
          >
            Medical Glossary
          </h1>
          <p
            style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: LIGHT_GREEN,
              margin: 0,
              fontWeight: 400,
            }}
          >
            Learn and understand common medical terms
          </p>
        </header>

        {/* Search band */}
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
              <BookSearchIcon color={`${NAVY}45`} />
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
                border: '1px solid rgba(25, 43, 63, 0.1)',
                borderRadius: RADIUS,
                outline: 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                background: '#ffffff',
                boxSizing: 'border-box',
                fontFamily: FONT_SANS,
                color: NAVY,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = NAVY
                e.target.style.boxShadow = `0 0 0 3px rgba(198, 217, 229, 0.65)`
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(25, 43, 63, 0.1)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
        </section>

        {/* Filters */}
        <section style={{ padding: '28px 0 8px' }}>
          <p
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: LIGHT_GREEN,
              margin: '0 0 14px',
            }}
          >
            Filter by category:
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              style={selectedTag === null ? pillActive : pillInactive}
            >
              All
            </button>
            {CATEGORY_ORDER.map((cat) => {
              const isSelected = selectedTag === cat
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedTag(isSelected ? null : cat)}
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

        {/* Grid */}
        <section style={{ paddingTop: 28 }}>
          {loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 16px',
                color: LIGHT_GREEN,
              }}
            >
              <p style={{ fontSize: '1rem', margin: 0, fontWeight: 500 }}>
                Loading terms…
              </p>
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                background: '#ffffff',
                border: `1px solid ${BORDER_SOFT}`,
                borderRadius: RADIUS,
                padding: 28,
                textAlign: 'center',
              }}
            >
              <p style={{ color: NAVY, fontWeight: 600, margin: 0 }}>
                {error}
              </p>
            </div>
          )}

          {!loading && !error && terms.length === 0 && (
            <div
              style={{
                background: '#ffffff',
                border: `1px solid ${BORDER_SOFT}`,
                borderRadius: RADIUS,
                padding: 40,
                textAlign: 'center',
              }}
            >
              <p style={{ color: NAVY, fontWeight: 600, margin: 0 }}>
                {selectedTag
                  ? `No ${formatCategoryLabel(selectedTag)} terms found`
                  : 'No terms match your search'}
              </p>
              <p style={{ color: LIGHT_GREEN, marginTop: 10, marginBottom: 0 }}>
                {selectedTag
                  ? 'Try a different category or search term'
                  : 'Try a different search term'}
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            terms.length > 0 &&
            filteredTerms.length === 0 &&
            selectedTag && (
            <div
              style={{
                background: '#ffffff',
                border: `1px solid ${BORDER_SOFT}`,
                borderRadius: RADIUS,
                padding: 40,
                textAlign: 'center',
              }}
            >
              <p style={{ color: NAVY, fontWeight: 600, margin: 0 }}>
                {`No ${formatCategoryLabel(selectedTag)} terms found`}
              </p>
              <p style={{ color: LIGHT_GREEN, marginTop: 10, marginBottom: 0 }}>
                Try a different category or search term
              </p>
            </div>
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
                  <article
                    key={term.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid rgba(25, 43, 63, 0.1)',
                      borderRadius: RADIUS,
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
                          color: NAVY,
                          margin: 0,
                          lineHeight: 1.35,
                        }}
                      >
                        {term.term}
                      </h3>
                      <span
                        style={{
                          flexShrink: 0,
                          background: 'rgba(245, 249, 249, 0.95)',
                          color: 'rgba(25, 43, 63, 0.75)',
                          padding: '6px 12px',
                          borderRadius: 999,
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          border: '1px solid rgba(25, 43, 63, 0.08)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {category}
                      </span>
                    </div>
                    <p
                      style={{
                        color: LIGHT_GREEN,
                        fontSize: '0.9375rem',
                        lineHeight: 1.7,
                        margin: 0,
                      }}
                    >
                      {term.definition}
                    </p>
                  </article>
                )
              })}
            </div>
          )}

          {!loading && !error && terms.length > 0 && (
            <p
              style={{
                textAlign: 'center',
                color: LIGHT_GREEN,
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
