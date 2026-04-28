import { useEffect, useMemo, useState } from 'react'
import { supabase, SupportResource } from '../lib/supabase'

type Category = 'All' | 'Mental Health' | 'Family Support' | 'Financial Aid' | 'Community'

const CATEGORIES: Category[] = ['All', 'Mental Health', 'Family Support', 'Financial Aid', 'Community']

const CATEGORY_COLORS: Record<Category, string> = {
  All: 'bg-gray-700 text-white',
  'Mental Health': 'bg-purple-600 text-white',
  'Family Support': 'bg-blue-600 text-white',
  'Financial Aid': 'bg-green-600 text-white',
  Community: 'bg-orange-500 text-white',
}

const CATEGORY_BADGE: Record<string, string> = {
  'Mental Health': 'bg-purple-100 text-purple-700',
  'Family Support': 'bg-blue-100 text-blue-700',
  'Financial Aid': 'bg-green-100 text-green-700',
  Community: 'bg-orange-100 text-orange-700',
}

export default function FindSupport() {
  const [resources, setResources] = useState<SupportResource[]>([])
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [locationQuery, setLocationQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('support_resources').select('*').order('name')
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
      const zip = (r.zipcode ?? '').toLowerCase()
      const city = (r.city ?? '').toLowerCase()

      if (zip === query || city === query) return [{ r, score: 0 }]
      if (zip.startsWith(query.slice(0, 3)) && query.length >= 3) return [{ r, score: 1 }]
      if (zip.includes(query) || city.includes(query)) return [{ r, score: 2 }]
      return []
    })

    scored.sort((a, b) => a.score - b.score || a.r.name.localeCompare(b.r.name))
    return scored.map(({ r }) => r)
  }, [resources, activeCategory, locationQuery])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-rose-700">Find Support</h1>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat
                ? CATEGORY_COLORS[cat]
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={locationQuery}
        onChange={(e) => setLocationQuery(e.target.value)}
        placeholder="Filter by Zipcode or City..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-sm">Loading resources...</p>
        </div>
      ) : sortedResources.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">No resources found.</p>
      ) : (
        <ul className="space-y-4">
          {sortedResources.map((r) => (
            <li
              key={r.id}
              className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 text-base leading-snug">{r.name}</h3>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_BADGE[r.category] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {r.category}
                </span>
              </div>

              {r.description && (
                <p className="text-sm text-gray-600 leading-snug">{r.description}</p>
              )}

              {(r.city || r.zipcode) && (
                <p className="text-xs text-gray-400">
                  {[r.city, r.zipcode].filter(Boolean).join(', ')}
                </p>
              )}

              {r.link && (
                <a
                  href={r.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  Visit Resource
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
