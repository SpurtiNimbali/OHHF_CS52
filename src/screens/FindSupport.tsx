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

type UserProfileFields = {
  diagnosis_age_category: string | null
  current_age_category: string | null
  condition: string | null
}

function isSchoolAgeOrBelow(currentAgeCategory: string | null | undefined): boolean {
  if (!currentAgeCategory?.trim()) return false
  return (SCHOOL_AGE_OR_BELOW_LABELS as readonly string[]).includes(currentAgeCategory.trim())
}

/** Stored `condition` is comma-separated category titles from onboarding. */
function conditionIsGeneticOrMentalHealth(condition: string | null | undefined): boolean {
  if (!condition?.trim()) return false
  const c = condition.toLowerCase()
  return /\bgenetic\b/.test(c) || /mental health/.test(c)
}

/**
 * Placeholder rules (will be replaced later).
 * Age: school-or-below → Mental Health / Family Support only; older → Financial Aid / Community only.
 * Condition: Genetic or Mental Health → Mental Health / Family Support; else → Financial Aid / Community.
 */
function passesPersonalizationFilters(
  personalizeByAge: boolean,
  personalizeByCondition: boolean,
  profile: UserProfileFields | null,
  bucket: SupportFilterCategory | 'other',
): boolean {
  const anyOn = personalizeByAge || personalizeByCondition
  if (!anyOn) return true
  if (bucket === 'other') return false

  const isMentalOrFamily = bucket === 'Mental Health' || bucket === 'Family Support'
  const isFinOrCommunity = bucket === 'Financial Aid' || bucket === 'Community'

  let allowed = true

  if (personalizeByAge) {
    const age = profile?.current_age_category
    if (age?.trim()) {
      const below = isSchoolAgeOrBelow(age)
      const ageOk = below ? isMentalOrFamily : isFinOrCommunity
      allowed = allowed && ageOk
    }
  }

  if (personalizeByCondition) {
    const cond = profile?.condition
    if (cond?.trim()) {
      const geneticOrMental = conditionIsGeneticOrMentalHealth(cond)
      const condOk = geneticOrMental ? isMentalOrFamily : isFinOrCommunity
      allowed = allowed && condOk
    }
  }

  return allowed
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

function normalizeCategoryLabel(raw: string | number | null | undefined): string {
  if (raw == null) return ''
  return String(raw).trim()
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
      const zip = String(r.zipcode ?? '').toLowerCase()

      return (
        name.includes(q) ||
        desc.includes(q) ||
        (city.length > 0 && city.includes(q)) ||
        (zip.length > 0 && zip.includes(q))
      )
    })
  }, [resources, query, selectedCategory])

  const personalizedResources = useMemo(() => {
    return filteredResources.filter((r) => {
      const bucket = normalizeSupportCategoryBucket(r.category)
      return passesPersonalizationFilters(
        personalizeByAge,
        personalizeByCondition,
        userProfile,
        bucket,
      )
    })
  }, [filteredResources, personalizeByAge, personalizeByCondition, userProfile])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
        padding: '0',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 45%, #a78bfa 100%)',
          padding: '40px 24px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            left: '-50px',
            width: '200px',
            height: '200px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-30px',
            right: '10%',
            width: '150px',
            height: '150px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20%',
            width: '80px',
            height: '80px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '50%',
          }}
        />

        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            color: '#ffffff',
            margin: 0,
            textShadow: '0 2px 10px rgba(0,0,0,0.2)',
            position: 'relative',
          }}
        >
          🤝 Find Support
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '1.1rem',
            marginTop: '12px',
            position: 'relative',
          }}
        >
          Community resources and connections for heart families
        </p>
      </div>

      <div
        style={{
          maxWidth: '800px',
          margin: '-30px auto 30px',
          padding: '0 20px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 10px 40px rgba(236, 72, 153, 0.18)',
          }}
        >
          <SearchBar value={query} onChange={setQuery} placeholder="Search resources..." />

          <div style={{ marginTop: '16px' }}>
            <p
              style={{
                fontSize: '0.85rem',
                color: '#888',
                marginBottom: '10px',
                fontWeight: 600,
              }}
            >
              Filter by category:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: selectedCategory === null ? '2px solid #ec4899' : '2px solid #e0e0e0',
                  background: selectedCategory === null ? '#ec4899' : '#ffffff',
                  color: selectedCategory === null ? '#ffffff' : '#666',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                All
              </button>
              {FILTER_CATEGORIES.map((cat) => {
                const colors = categoryColors[cat]
                const isSelected = selectedCategory === cat
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setSelectedCategory(isSelected ? null : cat)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: isSelected ? `2px solid ${colors.text}` : `2px solid ${colors.border}`,
                      background: isSelected ? colors.text : colors.bg,
                      color: isSelected ? '#ffffff' : colors.text,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #f3f4f6',
            }}
          >
            <p
              style={{
                fontSize: '0.85rem',
                color: '#888',
                marginBottom: '12px',
                fontWeight: 600,
              }}
            >
              Personalize from your profile (PLACEHOLDER RULES CURRENTLY):
            </p>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                marginBottom: '10px',
                fontSize: '0.9rem',
                color: '#444',
              }}
            >
              <input
                type="checkbox"
                checked={personalizeByAge}
                onChange={(e) => setPersonalizeByAge(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#ec4899' }}
              />
              Related to age
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: '#444',
              }}
            >
              <input
                type="checkbox"
                checked={personalizeByCondition}
                onChange={(e) => setPersonalizeByCondition(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#ec4899' }}
              />
              Related to condition
            </label>
          </div>

          <p
            style={{
              marginTop: '14px',
              marginBottom: 0,
              fontSize: '0.8rem',
              color: '#9ca3af',
              lineHeight: 1.45,
            }}
          >
            Tap a card to open the resource website.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px 40px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '3rem' }}>⏳</div>
            <p style={{ color: '#ec4899', fontSize: '1.2rem', fontWeight: 600 }}>Loading resources...</p>
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              background: '#ffebee',
              border: '2px solid #ffcdd2',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <p style={{ color: '#c62828', fontWeight: 600, marginTop: '8px' }}>{error}</p>
          </div>
        )}

        {!loading && !error && resources.length === 0 && (
          <div
            style={{
              background: '#fff8e1',
              border: '2px solid #ffe082',
              borderRadius: '16px',
              padding: '40px 24px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '3rem' }}>📋</span>
            <p style={{ color: '#f57f17', fontSize: '1.2rem', fontWeight: 600, marginTop: '12px' }}>
              No resources yet
            </p>
          </div>
        )}

        {!loading && !error && resources.length > 0 && filteredResources.length === 0 && (
          <div
            style={{
              background: '#fff8e1',
              border: '2px solid #ffe082',
              borderRadius: '16px',
              padding: '40px 24px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '3rem' }}>🔍</span>
            <p style={{ color: '#f57f17', fontSize: '1.2rem', fontWeight: 600, marginTop: '12px' }}>
              {selectedCategory
                ? `No ${selectedCategory} resources match`
                : 'No resources match your search'}
            </p>
            <p style={{ color: '#f57f17', opacity: 0.85, marginTop: '8px', fontSize: '0.95rem' }}>
              Try another search or category.
            </p>
          </div>
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
