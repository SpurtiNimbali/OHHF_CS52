import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase, ensureAuthUserId, SupportResource } from '../lib/supabase'
import { useMood } from '../mood'

const FILTER_CATEGORIES = [
  'Mental Health',
  'Family Support',
  'Financial Aid',
  'Community',
] as const

const CATEGORIES = ['All', ...FILTER_CATEGORIES] as const
type Category = (typeof CATEGORIES)[number]

type UserProfileFields = {
  diagnosis_age_category: string | null
  current_age_category: string | null
  condition: string | null
}

// ── ResourceCard ─────────────────────────────────────────────────────────────

function ResourceCard({ resource }: { resource: SupportResource }) {
  const [hovered, setHovered] = useState(false)

  return (
    <li
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: '1px solid rgba(25, 43, 63, 0.1)',
        borderRadius: '14px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: hovered ? '0 8px 28px rgba(25, 43, 63, 0.08)' : '0 2px 10px rgba(25, 43, 63, 0.04)',
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
          fontSize: '0.6875rem',
          fontWeight: 600,
          background: 'rgba(245, 249, 249, 0.98)',
          color: 'rgba(25, 43, 63, 0.8)',
          padding: '5px 11px',
          borderRadius: '100px',
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: '0.02em',
          border: '1px solid rgba(25, 43, 63, 0.08)',
        }}>
          {resource.category}
        </span>
      </div>

      {resource.description && (
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#577568', lineHeight: 1.65, fontFamily: 'Inter, system-ui, sans-serif' }}>
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
            gap: '8px',
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
          Visit Website
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden style={{ flexShrink: 0 }}>
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>
      )}
    </li>
  )
}

function CategoryChips({ active, onChange }: { active: Category; onChange: (c: Category) => void }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {CATEGORIES.map((cat) => {
        const isActive = cat === active
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            style={{
              padding: '8px 18px',
              borderRadius: 999,
              fontSize: '0.8rem',
              fontWeight: 600,
              fontFamily: 'Inter, system-ui, sans-serif',
              cursor: 'pointer',
              border: isActive ? 'none' : '1px solid rgba(25, 43, 63, 0.12)',
              background: isActive ? '#192b3f' : '#ffffff',
              color: isActive ? '#ffffff' : '#192b3f',
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

function normalizeCategoryLabel(raw: string | number | null | undefined): string {
  if (raw == null) return ''
  return String(raw).trim()
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
  const { theme } = useMood()
  const [resources, setResources] = useState<SupportResource[]>([])
  const [locationQuery, setLocationQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')
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
    const q = locationQuery.trim().toLowerCase()
    return resources.filter((r) => {
      const cat = normalizeCategoryLabel(r.category)
      if (activeCategory !== 'All') {
        if (cat.toLowerCase() !== activeCategory.toLowerCase()) return false
      }
      if (!q) return true
      const name = String(r.name ?? '').toLowerCase()
      const desc = String(r.description ?? '').toLowerCase()
      const city = String(r.city ?? '').toLowerCase()
      const zip = String(r.zipcode ?? '').toLowerCase()
      return name.includes(q) || desc.includes(q) || city.includes(q) || zip.includes(q)
    })
  }, [resources, locationQuery, activeCategory])

  const personalizeActive = personalizeByAge || personalizeByCondition

  const personalizedResources = useMemo(() => {
    if (!personalizeActive) return []
    if (!userProfile) return []
    return filteredResources.filter((r) => {
      if (personalizeByCondition && userProfile.condition?.trim()) {
        const needle = userProfile.condition.trim().toLowerCase()
        const hay = `${r.name ?? ''} ${r.description ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (personalizeByAge) {
        return true
      }
      return personalizeByCondition
    })
  }, [filteredResources, personalizeActive, userProfile, personalizeByAge, personalizeByCondition])

  const sortedResources = useMemo(() => {
    const copy = [...filteredResources]
    copy.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
    return copy
  }, [filteredResources])

  return (
    <div style={{ minHeight: '100%', background: '#f5f9f9', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '24px 24px 72px' }}>

        {/* Header — mood accent matches Home / Resources */}
        <div
          style={{
            marginBottom: '28px',
            paddingBottom: '20px',
            borderBottom: '4px solid transparent',
            borderImage: theme.borderGradient,
            transition: 'border-image 0.7s ease',
          }}
        >
          <h1 style={{
            margin: '0 0 10px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#192b3f',
            lineHeight: 1.15,
            textTransform: 'uppercase',
          }}>
            Find Support
          </h1>
          <p style={{ margin: 0, fontSize: '0.9375rem', color: '#acb7a8', lineHeight: 1.65, fontFamily: 'Inter, system-ui, sans-serif', maxWidth: '560px' }}>
            Resources for heart families — near you and online.
          </p>
        </div>

        {/* Search */}
        <div style={{
          background: 'rgba(198, 217, 229, 0.42)',
          borderRadius: 16,
          padding: '18px 20px',
          marginBottom: '22px',
          border: '1px solid rgba(25, 43, 63, 0.06)',
        }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#acb7a8', fontSize: '1rem' }}>
              📍
            </span>
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="Search by city or zip code..."
              style={{
                width: '100%',
                padding: '14px 18px 14px 44px',
                borderRadius: 9999,
                border: '1px solid rgba(25, 43, 63, 0.12)',
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
          personalizeActive &&
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
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: '#192b3f',
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
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        padding: '5px 11px',
                        borderRadius: '999px',
                        background: 'rgba(245, 249, 249, 0.98)',
                        color: 'rgba(25, 43, 63, 0.8)',
                        border: '1px solid rgba(25, 43, 63, 0.08)',
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
                        color: '#577568',
                        fontSize: '0.9375rem',
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
                        color: '#acb7a8',
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
                      height: '3px',
                      background: 'rgba(198, 217, 229, 0.65)',
                      borderRadius: '2px',
                    }}
                  />
                </>
              )

              const cardShellStyle: CSSProperties = {
                background: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 2px 12px rgba(25, 43, 63, 0.06)',
                border: '1px solid rgba(25, 43, 63, 0.1)',
                transition: 'all 0.25s ease',
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
                      e.currentTarget.style.transform = 'translateY(-3px)'
                      e.currentTarget.style.boxShadow = '0 10px 28px rgba(25, 43, 63, 0.1)'
                      e.currentTarget.style.borderColor = 'rgba(87, 117, 104, 0.45)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 12px rgba(25, 43, 63, 0.06)'
                      e.currentTarget.style.borderColor = 'rgba(25, 43, 63, 0.1)'
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
                    e.currentTarget.style.borderColor = 'rgba(87, 117, 104, 0.45)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(25, 43, 63, 0.1)'
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
