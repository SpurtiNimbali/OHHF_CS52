import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResourcesPageEmpty,
  ResourcesPageError,
  ResourcesPageLoading,
} from '../components/ResourcesPageStates'
import { SupportResourceListCard } from '../components/support/supportResourceListCard'
import { SupportCategoryChips } from '../components/ui/supportCategoryChips'
import { normalizeCategoryLabel } from '../lib/supportResourceHref'
import { supabase, ensureAuthUserId, SupportResource } from '../lib/supabase'
import {
  CARDEA_ALMOST_WHITE,
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
type SupportFilterCategory = (typeof FILTER_CATEGORIES)[number]

function normalizeSupportCategoryBucket(raw: string | number | null | undefined): SupportFilterCategory | 'other' {
  const label = normalizeCategoryLabel(raw)
  const key = FILTER_CATEGORIES.find((c) => c.toLowerCase() === label.toLowerCase())
  return key ?? 'other'
}

export default function FindSupport() {
  const { theme } = useMood()
  const [resources, setResources] = useState<SupportResource[]>([])
  const [locationQuery, setLocationQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: dbError } = await supabase
      .from('support_resources')
      .select('id, name, description, link, location, zipcode, category')
      .order('name', { ascending: true })

    if (dbError) {
      setResources([])
      setError(dbError.message)
    } else {
      setResources((data as SupportResource[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await ensureAuthUserId()
      if (!cancelled) load()
    })()
    return () => {
      cancelled = true
    }
  }, [load])

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
        const location = String(r.location ?? '').toLowerCase()
        const zip = String(r.zipcode ?? '').toLowerCase()

        const hasTextMatch = name.includes(q) || desc.includes(q)
        const hasLocation = Boolean(location || zip)

        let score = 5
        if (location === q || zip === q) score = 0
        else if (location.startsWith(q) || zip.startsWith(q)) score = 1
        else if (location.includes(q) || zip.includes(q)) score = 2
        else if (hasTextMatch) score = 3
        else if (!hasLocation) score = 4

        return { r, score }
      })
      .filter(({ score }) => score < 5)

    scored.sort(
      (a, b) => a.score - b.score || (a.r.name ?? '').localeCompare(b.r.name ?? ''),
    )
    return scored.map(({ r }) => r)
  }, [resources, activeCategory, locationQuery])

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
            Local and national resources for mental health, family support, financial help, and community.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(198, 217, 229, 0.42)',
            borderRadius: 16,
            padding: '20px 22px',
            marginBottom: 24,
          }}
        >
          <label
            htmlFor="support-location-search"
            style={{
              display: 'block',
              marginBottom: 10,
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: CARDEA_NAVY,
            }}
          >
            Search by city or zip
          </label>
          <input
            id="support-location-search"
            type="search"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            placeholder="e.g. Palo Alto or 94305"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid rgba(25, 43, 63, 0.12)',
              fontSize: '0.9375rem',
              fontFamily: 'Inter, system-ui, sans-serif',
              color: CARDEA_NAVY,
              background: '#fff',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: '28px' }}>
          <SupportCategoryChips options={CATEGORIES} active={activeCategory} onChange={setActiveCategory} />
        </div>

        {loading ? (
          <ResourcesPageLoading label="Loading resources…" />
        ) : error ? (
          <ResourcesPageError message={error} onRetry={() => load()} />
        ) : resources.length === 0 ? (
          <ResourcesPageEmpty
            title="No support resources yet"
            description="Resources will appear here once they are added to the database."
          />
        ) : filteredResources.length === 0 ? (
          <ResourcesPageEmpty
            title={activeCategory !== 'All' ? `No ${activeCategory} resources match` : 'No resources match your search'}
            description="Try a different category, city, or zip code."
          />
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredResources.map((r) => (
                <SupportResourceListCard key={r.id} resource={r} />
              ))}
            </ul>
            <p
              style={{
                textAlign: 'center',
                color: CARDEA_MUTED,
                marginTop: 36,
                fontSize: '0.875rem',
              }}
            >
              Showing {filteredResources.length} of {resources.length} resource
              {resources.length !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
