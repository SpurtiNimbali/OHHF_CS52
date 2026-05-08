import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResourcesPageEmpty,
  ResourcesPageError,
  ResourcesPageLoading,
} from '../components/ResourcesPageStates'
import { PersonalizedSupportGridCard } from '../components/support/supportResourceGridCard'
import { SupportResourceListCard } from '../components/support/supportResourceListCard'
import { PersonalizationMismatchBanner } from '../components/ui/personalizationMismatchBanner'
import { SupportCategoryChips } from '../components/ui/supportCategoryChips'
import { normalizeCategoryLabel, safeExternalHref } from '../lib/supportResourceHref'
import { supabase, ensureAuthUserId, SupportResource } from '../lib/supabase'
import {
  CARDEA_ALMOST_WHITE,
  CARDEA_LIGHT_BLUE,
  CARDEA_MUTED,
  CARDEA_NAVY,
} from '../ui/cardeaTokens'
import { useMood } from '../mood'

const FILTER_CATEGORIES = [
  'Mental Health',
  'Family Support',
  'Financial Aid',
  'Community',
] as const

const CATEGORIES = ['All', ...FILTER_CATEGORIES] as const
type Category = (typeof CATEGORIES)[number]

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

function normalizeCategoryLabel(raw: string | number | null | undefined): string {
  return String(raw ?? '').trim()
}

type UserProfileFields = {
  diagnosis_age_category?: string | null
  current_age_category?: string | null
  condition?: string | null
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
  const { theme } = useMood()
  const [resources, setResources] = useState<SupportResource[]>([])
  const [locationQuery, setLocationQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authBootstrapped, setAuthBootstrapped] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfileFields | null>(null)
  const [personalizeByAge] = useState(false)
  const [personalizeByCondition] = useState(false)

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

    const inCategory = resources.filter((r) => {
      if (activeCategory === 'All') return true
      const bucket = normalizeSupportCategoryBucket(r.category)
      return bucket !== 'other' && bucket === activeCategory
    })

    if (!q) return inCategory

    const scored = inCategory
      .map((r) => {
        const name = String(r.name ?? '').toLowerCase()
        const desc = String(r.description ?? '').toLowerCase()
        const city = String(r.city ?? '').toLowerCase()
        const zip = String(r.zipcode ?? '').toLowerCase()

        const hasTextMatch = name.includes(q) || desc.includes(q)
        const hasLocation = Boolean(city || zip)

        let score = 5
        if (city === q || zip === q) score = 0
        else if (city.startsWith(q) || zip.startsWith(q)) score = 1
        else if (city.includes(q) || zip.includes(q)) score = 2
        else if (hasTextMatch) score = 3
        else if (!hasLocation) score = 4

        return { r, score }
      })
      .filter(({ score }) => score < 5)

    scored.sort(
      (a, b) => a.score - b.score || (a.r.name ?? '').localeCompare(b.r.name ?? '')
    )
    return scored.map(({ r }) => r)
  }, [resources, activeCategory, locationQuery])

  const sortedResources = filteredResources

  const personalizedResources = useMemo(() => {
    if (!personalizeByAge && !personalizeByCondition) return []
    return sortedResources
  }, [sortedResources, personalizeByAge, personalizeByCondition])

  return (
    <div style={{ minHeight: '100%', background: CARDEA_ALMOST_WHITE, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '24px 24px 72px' }}>
        <div
          style={{
            marginBottom: '28px',
            paddingBottom: '20px',
            borderBottom: '4px solid transparent',
            borderImage: theme.borderGradient,
            transition: 'border-image 0.7s ease',
          }}
        >
          <h1
            style={{
              margin: '0 0 10px',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: CARDEA_NAVY,
              lineHeight: 1.15,
              textTransform: 'uppercase',
            }}
          >
            Find Support
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              color: CARDEA_MUTED,
              lineHeight: 1.65,
              fontFamily: 'Inter, system-ui, sans-serif',
              maxWidth: '560px',
            }}
          />
        </div>

        {/* Category chips */}
        <div style={{ marginBottom: '28px' }}>
          <CategoryChips active={activeCategory} onChange={setActiveCategory} />
        </div>

        {loading ? (
          <ResourcesPageLoading label="Loading resources…" />
        ) : error ? (
          <ResourcesPageError message={error} onRetry={() => load(userId)} />
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
          (personalizeByAge || personalizeByCondition) &&
          personalizedResources.length === 0 && (
            <div
              style={{
                background: 'rgba(198, 217, 229, 0.42)',
                borderRadius: 16,
                padding: '18px 20px',
                marginBottom: '22px',
                border: '1px solid rgba(25, 43, 63, 0.06)',
              }}
            >
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: CARDEA_MUTED,
                    fontSize: '1rem',
                  }}
                >
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
                    color: CARDEA_NAVY,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s ease',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <SupportCategoryChips options={CATEGORIES} active={activeCategory} onChange={setActiveCategory} />
            </div>

            <div style={{ height: '1px', background: CARDEA_LIGHT_BLUE, marginBottom: '28px' }} />

            {sortedResources.length === 0 ? (
              <ResourcesPageEmpty
                icon={<span aria-hidden>💛</span>}
                title="No resources match your filters"
                description="Try a different city or zip, pick another category, or clear your search."
              />
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {sortedResources.map((r) => (
                  <SupportResourceListCard key={r.id} resource={r} />
                ))}
              </ul>
            )}

            {personalizeActive &&
              resources.length > 0 &&
              filteredResources.length > 0 &&
              personalizedResources.length === 0 && (
                <PersonalizationMismatchBanner
                  title="No resources match your personalization settings"
                  description="Try turning off the age or condition options above, or adjust your search or category filter."
                />
              )}

            {personalizedResources.length > 0 && (
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
                  return (
                    <PersonalizedSupportGridCard
                      key={r.id}
                      resource={r}
                      categoryLabel={catLabel}
                      locationLine={locationLine}
                      href={href}
                      index={index}
                    />
                  )
                })}
              </div>
            )}

            {personalizedResources.length > 0 && (
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
          </>
        )}
      </div>
    </div>
  )
}
