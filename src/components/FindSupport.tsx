import { useEffect, useMemo, useState } from 'react'
import { supabase, SupportResource } from '../lib/supabase'

type Category = 'All' | 'Mental Health' | 'Family Support' | 'Financial Aid' | 'Community'

const CATEGORIES: Category[] = ['All', 'Mental Health', 'Family Support', 'Financial Aid', 'Community']

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

// ── CategoryChips ─────────────────────────────────────────────────────────────

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

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function FindSupport() {
  const [resources, setResources] = useState<SupportResource[]>([])
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [locationQuery, setLocationQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('support_resources').select('*').order('name')
      console.log('[FindSupport] fetch:', { count: data?.length, error })
      if (data) setResources(data as SupportResource[])
      setLoading(false)
    }
    load()
  }, [])

  const sortedResources = useMemo(() => {
    const query = locationQuery.trim().toLowerCase()

    const categoryFiltered = resources.filter(
      (r) => activeCategory === 'All' || r.category === activeCategory,
    )

    if (!query) return categoryFiltered

    const scored = categoryFiltered.flatMap((r) => {
      const zip = String(r.zipcode ?? '').toLowerCase()
      const city = String(r.city ?? '').toLowerCase()
      const hasLocation = zip || city

      if (city === query || zip === query) return [{ r, score: 0 }]
      if (city.startsWith(query)) return [{ r, score: 1 }]
      if (query.length >= 3 && zip.startsWith(query.slice(0, 3))) return [{ r, score: 2 }]
      if (city.includes(query) || zip.includes(query)) return [{ r, score: 3 }]
      if (!hasLocation) return [{ r, score: 4 }]
      return []
    })

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

      </div>
    </div>
  )
}
