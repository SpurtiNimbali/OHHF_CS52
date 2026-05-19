import { useEffect, useMemo, useState } from 'react'
import {
  ResourcesPageEmpty,
  ResourcesPageError,
  ResourcesPageLoading,
} from '../components/ResourcesPageStates'
import { fetchCareTeamCorpusList, type CareTeamCorpusListItem } from '../lib/careTeamCorpusApi'

const NAVY = '#192b3f'
const DARK_GREEN = '#577568'
const MUTED_GREEN = '#acb7a8'

function groupByCategory(questions: CareTeamCorpusListItem[]): Map<string, CareTeamCorpusListItem[]> {
  const map = new Map<string, CareTeamCorpusListItem[]>()
  for (const q of questions) {
    const cat = q.question_category?.trim() || 'General'
    const list = map.get(cat) ?? []
    list.push(q)
    map.set(cat, list)
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.question.localeCompare(b.question))
  }
  return map
}

export default function StandardCareTeamQuestions() {
  const [questions, setQuestions] = useState<CareTeamCorpusListItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchCareTeamCorpusList()
        if (cancelled) return
        setQuestions(data.questions)
        setCategories(data.categories)
      } catch (e) {
        if (!cancelled) {
          setQuestions([])
          setCategories([])
          setError(e instanceof Error ? e.message : 'Could not load standard questions.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!selectedCategory) return questions
    return questions.filter((q) => q.question_category === selectedCategory)
  }, [questions, selectedCategory])

  const grouped = useMemo(() => groupByCategory(filtered), [filtered])

  const sortedCategoryKeys = useMemo(() => [...grouped.keys()].sort((a, b) => a.localeCompare(b)), [grouped])

  if (loading) {
    return <ResourcesPageLoading label="Loading standard questions…" />
  }

  if (error) {
    return <ResourcesPageError message={error} onRetry={() => window.location.reload()} />
  }

  if (questions.length === 0) {
    return (
      <ResourcesPageEmpty
        title="No standard questions yet"
        description="The question library has not been loaded."
      />
    )
  }

  return (
    <div className="-mx-2 w-full sm:mx-0" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: NAVY }}>
      <div className="mb-6">
        <h1
          className="mb-2 text-3xl tracking-wide text-[#192b3f] sm:text-4xl"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}
        >
          STANDARD QUESTIONS
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: MUTED_GREEN }}>
          Browse our library of caregiver-tested questions, organized by purpose. Use these as inspiration for your
          next visit or with Generate Questions for a personalized list.
        </p>
      </div>

      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
              selectedCategory === null ? 'text-white' : 'bg-white/90 text-[#192b3f]'
            }`}
            style={
              selectedCategory === null
                ? { background: DARK_GREEN, borderColor: DARK_GREEN }
                : { borderColor: 'rgba(25, 43, 63, 0.15)' }
            }
          >
            All ({questions.length})
          </button>
          {categories.map((cat) => {
            const count = questions.filter((q) => q.question_category === cat).length
            const on = selectedCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                  on ? 'text-white' : 'bg-white/90 text-[#192b3f]'
                }`}
                style={on ? { background: DARK_GREEN, borderColor: DARK_GREEN } : { borderColor: 'rgba(25, 43, 63, 0.15)' }}
              >
                {cat} ({count})
              </button>
            )
          })}
        </div>
      )}

      <div className="space-y-10">
        {sortedCategoryKeys.map((category) => {
          const items = grouped.get(category) ?? []
          return (
            <section key={category}>
              <h2 className="mb-4 text-lg font-semibold text-[#192b3f]">{category}</h2>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.slug}
                    className="rounded-xl border bg-white p-4 shadow-sm"
                    style={{ borderColor: 'rgba(25, 43, 63, 0.1)' }}
                  >
                    <p className="text-sm font-medium leading-snug text-[#192b3f]">{item.question}</p>
                    {(item.visit_types.length > 0 || item.provider_types.length > 0) && (
                      <p className="mt-2 text-xs leading-relaxed" style={{ color: MUTED_GREEN }}>
                        {item.visit_types.length > 0 && (
                          <span>
                            <span className="font-semibold">Visits:</span> {item.visit_types.join(' · ')}
                          </span>
                        )}
                        {item.visit_types.length > 0 && item.provider_types.length > 0 && ' · '}
                        {item.provider_types.length > 0 && (
                          <span>
                            <span className="font-semibold">Care team:</span> {item.provider_types.join(' · ')}
                          </span>
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-sm italic" style={{ color: MUTED_GREEN }}>
          No questions in this category.
        </p>
      )}
    </div>
  )
}
