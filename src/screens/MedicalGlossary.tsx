import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

interface GlossaryTerm {
  id: number
  term: string
  definition: string
  category?: string
}

const NAVY = '#192b3f'
const LIGHT_BLUE = '#c6d9e5'
const ALMOST_WHITE = '#f5f9f9'
const DARK_GREEN = '#577568'
const LIGHT_GREEN = '#acb7a8'
const BORDER_SOFT = `${LIGHT_BLUE}99`
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
        const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL
        const supabaseKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Missing Supabase environment variables')
        }

        const supabase = createClient(supabaseUrl, supabaseKey)
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

  const divider = (
    <div
      style={{
        height: 1,
        background: LIGHT_BLUE,
        opacity: 0.55,
        margin: 0,
        border: 'none',
      }}
    />
  )

  const filteredTerms = terms.filter((t) => !selectedTag || getCategory(t.term) === selectedTag)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: ALMOST_WHITE,
        padding: '0 0 48px',
        fontFamily: FONT_SANS,
        color: NAVY,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '8px 24px 0',
        }}
      >
        <header style={{ paddingBottom: 28 }}>
          <h1
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 1.875rem)',
              fontWeight: 700,
              letterSpacing: '0.04em',
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
              lineHeight: 1.55,
              color: DARK_GREEN,
              margin: 0,
            }}
          >
            Learn and understand common medical terms
          </p>
        </header>
        {divider}

        {/* Search */}
        <section
          style={{
            background: ALMOST_WHITE,
            padding: '28px 0',
          }}
        >
          <div style={{ position: 'relative' }}>
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
              <BookSearchIcon color={`${NAVY}55`} />
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
                border: `1px solid ${BORDER_SOFT}`,
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
                e.target.style.boxShadow = `0 0 0 3px ${LIGHT_BLUE}`
              }}
              onBlur={(e) => {
                e.target.style.borderColor = BORDER_SOFT
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
        </section>
        {divider}

        {/* Filters */}
        <section
          style={{
            background: '#ffffff',
            padding: '26px 0',
            marginLeft: '-24px',
            marginRight: '-24px',
            paddingLeft: 24,
            paddingRight: 24,
          }}
        >
          <p
            style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: NAVY,
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
              style={{
                padding: '10px 18px',
                borderRadius: 999,
                border: selectedTag === null ? 'none' : `1px solid ${BORDER_SOFT}`,
                background: selectedTag === null ? NAVY : LIGHT_BLUE,
                color: selectedTag === null ? '#ffffff' : NAVY,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: FONT_SANS,
                transition: 'background 0.2s ease, color 0.2s ease',
              }}
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
                    padding: '10px 18px',
                    borderRadius: 999,
                    border: isSelected ? 'none' : `1px solid ${BORDER_SOFT}`,
                    background: isSelected ? NAVY : LIGHT_BLUE,
                    color: isSelected ? '#ffffff' : NAVY,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: FONT_SANS,
                    textTransform: 'capitalize',
                    transition: 'background 0.2s ease, color 0.2s ease',
                  }}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </section>
        {divider}

        {/* List */}
        <section style={{ paddingTop: 28 }}>
          {loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 16px',
                color: DARK_GREEN,
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
              <p style={{ color: DARK_GREEN, marginTop: 10, marginBottom: 0 }}>
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
              <p style={{ color: DARK_GREEN, marginTop: 10, marginBottom: 0 }}>
                Try a different category or search term
              </p>
            </div>
          )}

          {!loading && !error && filteredTerms.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
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
                      border: `1px solid ${BORDER_SOFT}`,
                      borderRadius: RADIUS,
                      padding: '22px 24px',
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
                          fontSize: '1.125rem',
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
                          background: ALMOST_WHITE,
                          color: NAVY,
                          padding: '6px 12px',
                          borderRadius: 999,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          border: `1px solid ${BORDER_SOFT}`,
                          textTransform: 'capitalize',
                        }}
                      >
                        {category}
                      </span>
                    </div>
                    <p
                      style={{
                        color: DARK_GREEN,
                        fontSize: '0.9375rem',
                        lineHeight: 1.65,
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
                color: DARK_GREEN,
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
