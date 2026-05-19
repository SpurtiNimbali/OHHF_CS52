import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResourcesPageError,
  ResourcesPageLoading,
} from '../components/ResourcesPageStates'
import { SupportResourceListCard } from '../components/support/supportResourceListCard'
import { PersonalizationMismatchBanner } from '../components/ui/personalizationMismatchBanner'
import {
  mapSupportResourceRow,
  normalizeSupportCategory,
  resourceMatchesChildAge,
  resourceMatchesLocationQuery,
  scoreResourceLocationMatch,
  SUPPORT_FILTER_CATEGORIES,
} from '../lib/supportResource'
import { supabase, ensureAuthUserId, SupportResource } from '../lib/supabase'
import {
  CARDEA_ALMOST_WHITE,
  CARDEA_DARK_GREEN,
  CARDEA_LIGHT_BLUE,
  CARDEA_MUTED,
  CARDEA_NAVY,
} from '../ui/cardeaTokens'
import { useMood } from '../mood'

const CATEGORIES = ['All', ...SUPPORT_FILTER_CATEGORIES] as const
type Category = (typeof CATEGORIES)[number]

type UserProfileFields = {
  current_age_category: string | null
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
              background: isActive ? CARDEA_NAVY : '#ffffff',
              color: isActive ? '#ffffff' : CARDEA_NAVY,
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


export default function FindSupport() {
  const { theme } = useMood()
  const [resources, setResources] = useState<SupportResource[]>([])
  const [locationQuery, setLocationQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [filterByAge, setFilterByAge] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authBootstrapped, setAuthBootstrapped] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfileFields | null>(null)

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

    const resourcesQuery = supabase.from('support_resources').select('*').order('name', { ascending: true })

    const profileQuery = uid
      ? supabase.from('users').select('current_age_category').eq('id', uid).maybeSingle()
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
      setResources((data ?? []).map((row) => mapSupportResourceRow(row as Record<string, unknown>)))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authBootstrapped) return
    load(userId)
  }, [authBootstrapped, userId, load])

  const childCurrentAge = userProfile?.current_age_category ?? null

  const filteredResources = useMemo(() => {
    const q = locationQuery.trim()

    let list = resources.filter((r) => {
      if (activeCategory !== 'All') {
        const bucket = normalizeSupportCategory(r.category)
        if (bucket === 'other' || bucket !== activeCategory) return false
      }
      if (filterByAge && !resourceMatchesChildAge(r.age, childCurrentAge)) return false
      return resourceMatchesLocationQuery(r, q)
    })

    if (q) {
      list = [...list].sort(
        (a, b) =>
          scoreResourceLocationMatch(a, q) - scoreResourceLocationMatch(b, q) ||
          String(a.name ?? '').localeCompare(String(b.name ?? '')),
      )
    } else {
      list = [...list].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
    }

    return list
  }, [resources, locationQuery, activeCategory, filterByAge, childCurrentAge])

  const showAgeMismatchBanner =
    !loading &&
    !error &&
    filterByAge &&
    Boolean(childCurrentAge?.trim()) &&
    resources.length > 0 &&
    filteredResources.length === 0

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
            Local and national resources for family support, mental health, camps, and financial aid.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(198, 217, 229, 0.42)',
            borderRadius: 16,
            padding: '18px 20px',
            marginBottom: '22px',
            border: '1px solid rgba(25, 43, 63, 0.06)',
          }}
        >
          <label htmlFor="support-location-search" className="sr-only">
            Search by city, zip code, or online
          </label>
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
              aria-hidden
            >
              📍
            </span>
            <input
              id="support-location-search"
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="Search by city, zip code, or online..."
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
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <CategoryChips active={activeCategory} onChange={setActiveCategory} />
        </div>

        <div
          style={{
            marginBottom: '24px',
            paddingTop: '16px',
            borderTop: `1px solid ${CARDEA_LIGHT_BLUE}`,
          }}
        >
          <p
            style={{
              fontSize: '0.85rem',
              color: CARDEA_MUTED,
              marginBottom: '12px',
              fontWeight: 600,
            }}
          >
            Personalize
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: childCurrentAge ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem',
              color: CARDEA_NAVY,
              opacity: childCurrentAge ? 1 : 0.65,
            }}
          >
            <input
              type="checkbox"
              checked={filterByAge}
              disabled={!childCurrentAge?.trim()}
              onChange={(e) => setFilterByAge(e.target.checked)}
              style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: CARDEA_DARK_GREEN }}
            />
            <span>
              Filter by my child&apos;s current age
              {childCurrentAge?.trim() ? (
                <span style={{ display: 'block', fontSize: '0.8rem', color: CARDEA_MUTED, marginTop: '4px' }}>
                  From your profile: {childCurrentAge}
                </span>
              ) : (
                <span style={{ display: 'block', fontSize: '0.8rem', color: CARDEA_MUTED, marginTop: '4px' }}>
                  Complete onboarding with your child&apos;s current age to use this filter.
                </span>
              )}
            </span>
          </label>
        </div>

        <div style={{ height: '1px', background: CARDEA_LIGHT_BLUE, marginBottom: '28px' }} />

        {loading ? (
          <ResourcesPageLoading label="Loading resources…" />
        ) : error ? (
          <ResourcesPageError message={error} onRetry={() => load(userId)} />
        ) : showAgeMismatchBanner ? (
          <PersonalizationMismatchBanner
            title="No resources match your child's age"
            description="Try turning off the age filter, choosing a different category, or broadening your location search."
          />
        ) : filteredResources.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💛</div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: CARDEA_MUTED }}>
              No resources found — try adjusting your filters.
            </p>
          </div>
        ) : (
          <>
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
              {filteredResources.map((r) => (
                <SupportResourceListCard key={r.id} resource={r} />
              ))}
            </ul>
            <p
              style={{
                textAlign: 'center',
                color: CARDEA_MUTED,
                marginTop: '30px',
                fontSize: '0.9rem',
              }}
            >
              Showing {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
