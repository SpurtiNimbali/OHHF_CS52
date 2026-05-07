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

type UserProfileFields = {
  diagnosis_age_category: string | null
  current_age_category: string | null
  condition: string | null
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
          >
            Resources for heart families — near you and online.
          </p>
        </div>

        {loading ? (
          <ResourcesPageLoading label="Loading resources…" />
        ) : error ? (
          <ResourcesPageError message={error} onRetry={() => load(userId)} />
        ) : (
          <>
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

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
