import { useEffect, useMemo, useState } from 'react'
import { supabase, SupportResource } from '../lib/supabase'

type Category = 'All' | 'Mental Health' | 'Family Support' | 'Financial Aid' | 'Community'

const CATEGORIES: Category[] = ['All', 'Mental Health', 'Family Support', 'Financial Aid', 'Community']

const CHIP_ACTIVE: Record<Category, string> = {
  All: 'bg-rose-500 text-white shadow-sm',
  'Mental Health': 'bg-purple-500 text-white shadow-sm',
  'Family Support': 'bg-blue-500 text-white shadow-sm',
  'Financial Aid': 'bg-emerald-500 text-white shadow-sm',
  Community: 'bg-orange-400 text-white shadow-sm',
}

const CATEGORY_BADGE: Record<string, string> = {
  'Mental Health': 'bg-purple-100 text-purple-600',
  'Family Support': 'bg-blue-100 text-blue-600',
  'Financial Aid': 'bg-emerald-100 text-emerald-600',
  Community: 'bg-orange-100 text-orange-600',
}

// ── ResourceCard ─────────────────────────────────────────────────────────────

function ResourceCard({ resource }: { resource: SupportResource }) {
  return (
    <li className="bg-white rounded-2xl shadow-sm border border-rose-100 p-5 space-y-3 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-gray-900 text-base leading-snug">{resource.name}</h3>
        <span
          className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
            CATEGORY_BADGE[resource.category] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {resource.category}
        </span>
      </div>

      {resource.description && (
        <p className="text-sm text-gray-500 leading-relaxed">{resource.description}</p>
      )}

      {(resource.city || resource.zipcode) && (
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-xs text-gray-400">
            {[resource.city, resource.zipcode].filter(Boolean).join(', ')}
          </p>
        </div>
      )}

      {resource.link && (
        <a
          href={resource.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-1 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all duration-150"
        >
          Visit Website
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </li>
  )
}

// ── CategoryChips ─────────────────────────────────────────────────────────────

function CategoryChips({
  active,
  onChange,
}: {
  active: Category
  onChange: (c: Category) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
            active === cat
              ? CHIP_ACTIVE[cat]
              : 'bg-white text-gray-500 border border-gray-200 hover:border-rose-200 hover:text-rose-500'
          }`}
        >
          {cat}
        </button>
      ))}
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

      // Exact city or zip match
      if (city === query || zip === query) return [{ r, score: 0 }]
      // City starts with query (e.g. "san" matches "San Francisco")
      if (city.startsWith(query)) return [{ r, score: 1 }]
      // Same zip region (first 3 digits)
      if (query.length >= 3 && zip.startsWith(query.slice(0, 3))) return [{ r, score: 2 }]
      // Any partial match in city or zip
      if (city.includes(query) || zip.includes(query)) return [{ r, score: 3 }]
      // No city/zip = online/national resource, always include but ranked last
      if (!hasLocation) return [{ r, score: 4 }]
      // No match at all
      return []
    })

    // null-safe sort: by score first, then alphabetically by name
    scored.sort(
      (a, b) =>
        a.score - b.score ||
        (a.r.name ?? '').localeCompare(b.r.name ?? ''),
    )
    return scored.map(({ r }) => r)
  }, [resources, activeCategory, locationQuery])

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div className="text-center mt-2 mb-6">
          <h1 className="text-3xl font-bold tracking-wide text-gray-900 leading-tight">
            Find Support
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Resources for heart families — near you and online.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <input
            type="text"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            placeholder="Search by city or zip code..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-rose-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
          />
        </div>

        {/* Category chips */}
        <CategoryChips active={activeCategory} onChange={setActiveCategory} />

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-gray-400 text-sm">Loading resources...</p>
          </div>
        ) : sortedResources.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">💛</div>
            <p className="text-sm text-gray-400">
              No resources found — try adjusting your filters.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {sortedResources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </ul>
        )}

      </div>
    </div>
  )
}
