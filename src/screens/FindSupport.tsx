import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResourcesPageError,
  ResourcesPageLoading,
} from '../components/ResourcesPageStates'
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
      .select('id, name, description, link, city, zipcode, category')
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

        {/* Category chips */}
        <div style={{ marginBottom: '28px' }}>
          <CategoryChips active={activeCategory} onChange={setActiveCategory} />
        </div>

        {loading ? (
          <ResourcesPageLoading label="Loading resources…" />
        ) : error ? (
          <ResourcesPageError message={error} onRetry={() => load()} />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sortedResources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
