import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
// @ts-expect-error - SearchBar is a JSX component without type declarations
import SearchBar from '../components/SearchBar'
import { supabase, ensureAuthUserId, SupportResource } from '../lib/supabase'

const FILTER_CATEGORIES = [
  'Mental Health',
  'Family Support',
  'Financial Aid',
  'Community',
] as const
type SupportFilterCategory = (typeof FILTER_CATEGORIES)[number]

/** Matches `welcomeScreen` age option labels; school age and younger vs older. */
const SCHOOL_AGE_OR_BELOW_LABELS = [
  'Prenatal',
  'Infant (1 and under)',
  'Preschooler (2-5)',
  'School Age (6-12)',
] as const

// ── ResourceCard ─────────────────────────────────────────────────────────────

function ResourceCard({ resource }: { resource: SupportResource }) {
  const [hovered, setHovered] = useState(false)

  return (
    <li
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1.5px solid ${hovered ? '#577568' : '#c6d9e5'}`,
        borderRadius: '14px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: hovered ? '0 8px 24px rgba(25,43,63,0.09)' : '0 2px 8px rgba(25,43,63,0.04)',
        transition: 'all 0.2s ease',
        listStyle: 'none',
      }}
    >
      {/* Name + category badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <h3 style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 700,
          color: '#192b3f',
          lineHeight: 1.3,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          {resource.name}
        </h3>
        <span style={{
          flexShrink: 0,
          fontSize: '0.72rem',
          fontWeight: 600,
          background: '#c6d9e5',
          color: '#192b3f',
          padding: '3px 10px',
          borderRadius: '100px',
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: '0.01em',
        }}>
          {resource.category}
        </span>
      </div>

      {resource.description && (
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#acb7a8', lineHeight: 1.65, fontFamily: 'Inter, system-ui, sans-serif' }}>
          {resource.description}
        </p>
      )}

      {(resource.city || resource.zipcode) && (
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#acb7a8', fontFamily: 'Inter, system-ui, sans-serif' }}>
          📍 {[resource.city, resource.zipcode].filter(Boolean).join(', ')}
        </p>
      )}

      {resource.link && (
        <a
          href={resource.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#577568',
            color: '#f5f9f9',
            padding: '8px 18px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'none',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'background 0.2s ease',
            width: 'fit-content',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#192b3f')}
          onMouseLeave={e => (e.currentTarget.style.background = '#577568')}
        >
          Visit Website ↗
        </a>
      )}
    </li>
  )
}

const categoryColors: Record<
  (typeof FILTER_CATEGORIES)[number] | 'other',
  { bg: string; text: string; border: string }
> = {
  'Mental Health': { bg: '#f3e8ff', text: '#7c3aed', border: '#d8b4fe' },
  'Family Support': { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  'Financial Aid': { bg: '#d1fae5', text: '#047857', border: '#6ee7b7' },
  Community: { bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },
  other: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' },
}

function CategoryChips({ active, onChange }: { active: Category; onChange: (c: Category) => void }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {CATEGORIES.map((cat) => {
        const isActive = cat === active
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            style={{
              padding: '7px 16px',
              borderRadius: '100px',
              fontSize: '0.8rem',
              fontWeight: 600,
              fontFamily: 'Inter, system-ui, sans-serif',
              cursor: 'pointer',
              border: `1.5px solid ${isActive ? '#577568' : '#c6d9e5'}`,
              background: isActive ? '#577568' : '#fff',
              color: isActive ? '#f5f9f9' : '#577568',
              transition: 'all 0.15s ease',
            }}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}

function normalizeSupportCategoryBucket(raw: string | number | null | undefined): SupportFilterCategory | 'other' {
  const label = normalizeCategoryLabel(raw)
  const key = FILTER_CATEGORIES.find((c) => c.toLowerCase() === label.toLowerCase())
  return key ?? 'other'
}

function categoryStyle(label: string) {
  const key = FILTER_CATEGORIES.find((c) => c.toLowerCase() === label.toLowerCase())
  return key ? categoryColors[key] : categoryColors.other
}

function normalizeExternalUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

/** Only allow http(s) URLs for clickable cards. */
function safeExternalHref(raw: string | number | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  try {
    const u = new URL(normalizeExternalUrl(s))
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
  } catch {
    /* ignore */
  }
  return null
}

export default function FindSupport() {
  const [resources, setResources] = useState<SupportResource[]>([])
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authBootstrapped, setAuthBootstrapped] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfileFields | null>(null)
  const [personalizeByAge, setPersonalizeByAge] = useState(false)
  const [personalizeByCondition, setPersonalizeByCondition] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const uid = await ensureAuthUserId()
      if (!cancelled) {
        setUserId(uid)
        setAuthBootstrapped(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!authBootstrapped) return
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [authBootstrapped])

  const load = useCallback(async (uid: string | null) => {
    setLoading(true)
    setError(null)

    const resourcesQuery = supabase
      .from('support_resources')
      .select('id, name, description, link, city, zipcode, category')
      .order('name', { ascending: true })

    const profileQuery = uid
      ? supabase
          .from('users')
          .select('diagnosis_age_category, current_age_category, condition')
          .eq('id', uid)
          .maybeSingle()
      : Promise.resolve({ data: null as UserProfileFields | null, error: null })

    const [{ data, error: dbError }, { data: profileRow, error: profileError }] = await Promise.all([
      resourcesQuery,
      profileQuery,
    ])

    if (!profileError && profileRow) {
      setUserProfile(profileRow as UserProfileFields)
    } else {
      setUserProfile(null)
    }

    if (dbError) {
      setResources([])
      setError(dbError.message)
    } else {
      setResources((data as SupportResource[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authBootstrapped) return
    load(userId)
  }, [authBootstrapped, userId, load])

  const filteredResources = useMemo(() => {
    const q = query.trim().toLowerCase()

    return resources.filter((r) => {
      const cat = normalizeCategoryLabel(r.category)
      if (selectedCategory) {
        if (cat.toLowerCase() !== selectedCategory.toLowerCase()) return false
      }

      if (!q) return true

      const name = String(r.name ?? '').toLowerCase()
      const desc = String(r.description ?? '').toLowerCase()
      const city = String(r.city ?? '').toLowerCase()
      const hasLocation = zip || city

      if (city === query || zip === query) return [{ r, score: 0 }]
      if (city.startsWith(query)) return [{ r, score: 1 }]
      if (query.length >= 3 && zip.startsWith(query.slice(0, 3))) return [{ r, score: 2 }]
      if (city.includes(query) || zip.includes(query)) return [{ r, score: 3 }]
      if (!hasLocation) return [{ r, score: 4 }]
      return []
    })
  }, [resources, query, selectedCategory])

    scored.sort((a, b) => a.score - b.score || (a.r.name ?? '').localeCompare(b.r.name ?? ''))
    return scored.map(({ r }) => r)
  }, [resources, activeCategory, locationQuery])

  return (
    <div style={{ minHeight: '100vh', background: '#f5f9f9', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px 72px' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{
            margin: '0 0 6px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#acb7a8',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            Cardea
          </p>
          <h1 style={{
            margin: '0 0 10px',
            fontFamily: 'var(--font-display, "Bebas Neue", sans-serif)',
            fontSize: 'clamp(2.2rem, 4vw, 3rem)',
            letterSpacing: '0.04em',
            color: '#192b3f',
            lineHeight: 1,
          }}>
            Find Support
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#acb7a8', lineHeight: 1.65, fontFamily: 'Inter, system-ui, sans-serif' }}>
            Resources for heart families — near you and online.
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#acb7a8', fontSize: '1rem' }}>
            📍
          </span>
          <input
            type="text"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            placeholder="Search by city or zip code..."
            style={{
              width: '100%',
              padding: '12px 16px 12px 40px',
              borderRadius: '12px',
              border: '1.5px solid #c6d9e5',
              background: '#fff',
              fontSize: '0.9rem',
              color: '#192b3f',
              fontFamily: 'Inter, system-ui, sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s ease',
            }}
          />
        </div>
      </div>

        {/* Category chips */}
        <div style={{ marginBottom: '28px' }}>
          <CategoryChips active={activeCategory} onChange={setActiveCategory} />
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: '#c6d9e5', marginBottom: '28px' }} />

        {/* Results */}
        {loading ? (
          <p style={{ textAlign: 'center', color: '#acb7a8', fontSize: '0.9rem', padding: '48px 0' }}>
            Loading resources…
          </p>
        ) : sortedResources.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💛</div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#acb7a8' }}>
              No resources found — try adjusting your filters.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sortedResources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </ul>
        )}

        {!loading &&
          !error &&
          resources.length > 0 &&
          filteredResources.length > 0 &&
          personalizedResources.length === 0 && (
            <div
              style={{
                background: '#fff8e1',
                border: '2px solid #ffe082',
                borderRadius: '16px',
                padding: '40px 24px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '3rem' }}>✨</span>
              <p style={{ color: '#f57f17', fontSize: '1.2rem', fontWeight: 600, marginTop: '12px' }}>
                No resources match your personalization settings
              </p>
              <p style={{ color: '#b45309', fontSize: '0.95rem', marginTop: '8px', lineHeight: 1.5 }}>
                Try turning off the age or condition options above, or adjust your search or category filter.
              </p>
            </div>
          )}

        {!loading && !error && personalizedResources.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
            }}
          >
            {personalizedResources.map((r, index) => {
              const catLabel = normalizeCategoryLabel(r.category) || 'Resource'
              const colors = categoryStyle(catLabel)
              const href = safeExternalHref(r.link)
              const locationLine = [r.city, r.zipcode]
                .filter((v) => v != null && String(v).trim() !== '')
                .map((v) => String(v))
                .join(', ')

              const cardInner = (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                      marginBottom: '12px',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        color: '#2c3e50',
                        margin: 0,
                        lineHeight: 1.35,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {r.name}
                    </h3>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        maxWidth: '46%',
                        textAlign: 'right',
                      }}
                    >
                      {catLabel}
                    </span>
                  </div>

                  {r.description ? (
                    <p
                      style={{
                        color: '#666',
                        fontSize: '0.95rem',
                        lineHeight: 1.55,
                        margin: '0 0 12px',
                      }}
                    >
                      {r.description}
                    </p>
                  ) : null}

                  {locationLine ? (
                    <p
                      style={{
                        margin: '0 0 12px',
                        fontSize: '0.85rem',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span aria-hidden>📍</span>
                      {locationLine}
                    </p>
                  ) : null}

                  <div
                    style={{
                      marginTop: 'auto',
                      paddingTop: '14px',
                      height: '4px',
                      background: `linear-gradient(90deg, ${colors.border}, ${colors.bg})`,
                      borderRadius: '2px',
                    }}
                  />
                </>
              )

              const cardShellStyle: CSSProperties = {
                background: '#ffffff',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                border: '2px solid transparent',
                transition: 'all 0.3s ease',
                animation: `fadeInUp 0.5s ease ${index * 0.04}s both`,
                height: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                cursor: href ? 'pointer' : 'default',
                textDecoration: 'none',
                color: 'inherit',
              }

              if (href) {
                return (
                  <a
                    key={r.id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${r.name} — opens in a new tab`}
                    style={cardShellStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-5px)'
                      e.currentTarget.style.boxShadow = '0 12px 40px rgba(236, 72, 153, 0.2)'
                      e.currentTarget.style.borderColor = colors.border
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
                      e.currentTarget.style.borderColor = 'transparent'
                    }}
                  >
                    {cardInner}
                  </a>
                )
              }

              return (
                <div
                  key={r.id}
                  style={cardShellStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.border
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent'
                  }}
                >
                  {cardInner}
                </div>
              )
            })}
          </div>
        )}

        {!loading && !error && personalizedResources.length > 0 && (
          <p
            style={{
              textAlign: 'center',
              color: '#888',
              marginTop: '30px',
              fontSize: '0.9rem',
            }}
          >
            Showing {personalizedResources.length} resource{personalizedResources.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
