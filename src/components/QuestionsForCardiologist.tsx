import { useEffect, useRef, useState, useMemo } from 'react'
import { supabase, CardiologistQuestion, SavedQuestion } from '../lib/supabase'

const CURRENT_USER_ID = 'demo-user-id'

type GroupedQuestions = Record<string, CardiologistQuestion[]>

// ── QuestionItem ─────────────────────────────────────────────────────────────

function QuestionItem({
  question,
  saved,
  onToggle,
}: {
  question: CardiologistQuestion
  saved: boolean
  onToggle: () => void
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()} // prevent input blur closing dropdown
      onClick={onToggle}
      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-rose-50 transition-colors text-left rounded-xl"
    >
      <div
        className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-150 ${
          saved ? 'bg-rose-500 border-rose-500 scale-105' : 'border-gray-300 bg-white'
        }`}
      >
        {saved && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-sm text-gray-700 leading-snug">{question.question_text}</span>
    </button>
  )
}

// ── QuestionDropdown ─────────────────────────────────────────────────────────

function QuestionDropdown({
  grouped,
  searchQuery,
  savedIds,
  customText,
  adding,
  onToggle,
  onCustomChange,
  onCustomSubmit,
}: {
  grouped: GroupedQuestions
  searchQuery: string
  savedIds: Set<string>
  customText: string
  adding: boolean
  onToggle: (q: CardiologistQuestion) => void
  onCustomChange: (v: string) => void
  onCustomSubmit: () => void
}) {
  const q = searchQuery.toLowerCase().trim()

  const filteredGroups = useMemo(() => {
    const result: GroupedQuestions = {}
    for (const [category, questions] of Object.entries(grouped)) {
      if (!category || !Array.isArray(questions)) continue
      const matches = q
        ? questions.filter((question) =>
            (question.question_text ?? '').toLowerCase().includes(q),
          )
        : questions
      if (matches.length > 0) result[category] = matches
    }
    return result
  }, [grouped, q])

  const hasResults = Object.keys(filteredGroups).length > 0
  const totalQuestions = Object.values(grouped).flat().length

  return (
    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl shadow-xl border border-rose-100 overflow-hidden">
      {/* Debug banner — remove once confirmed working */}
      {totalQuestions === 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
          <p className="text-xs text-amber-600">
            ⚠ No questions loaded — check console for fetch errors
          </p>
        </div>
      )}

      <div className="max-h-80 overflow-y-auto">
        {hasResults ? (
          Object.entries(filteredGroups).map(([category, questions]) => (
            <div key={category}>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-rose-400 uppercase tracking-wide">
                {category}
              </p>
              {questions.map((question) => (
                <QuestionItem
                  key={question.id}
                  question={question}
                  saved={savedIds.has(String(question.id))}
                  onToggle={() => onToggle(question)}
                />
              ))}
            </div>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">
            {totalQuestions === 0 ? 'No questions available.' : 'No questions match your search.'}
          </p>
        )}

        {/* Add your own */}
        <div
          className="border-t border-rose-100 px-4 py-3 bg-rose-50/60"
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="text-xs font-semibold text-rose-400 uppercase tracking-wide mb-2">
            Add your own question
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={customText}
              onChange={(e) => onCustomChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onCustomSubmit()}
              placeholder="Type your question..."
              className="flex-1 border border-rose-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCustomSubmit}
              disabled={adding || !customText.trim()}
              className="bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              + Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SavedQuestionsList ───────────────────────────────────────────────────────

function SavedQuestionsList({
  saved,
  grouped,
  onRemove,
}: {
  saved: SavedQuestion[]
  grouped: GroupedQuestions
  onRemove: (row: SavedQuestion) => void
}) {
  if (saved.length === 0) return null

  const allQuestions = Object.values(grouped).flat()

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <h2 className="text-base font-semibold text-gray-800">
          Your Saved Questions ({saved.length})
        </h2>
      </div>

      <ul className="space-y-2">
        {saved.map((row) => {
          const isCustom = !row.question_id
          const matchedQuestion = allQuestions.find(
            (q) => String(q.id) === String(row.question_id),
          )
          const label = row.custom_text ?? matchedQuestion?.question_text ?? ''
          const category = matchedQuestion?.category ?? null

          return (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 bg-white border border-rose-100 rounded-2xl px-4 py-3 shadow-sm"
            >
              <div className="flex items-start gap-2 min-w-0">
                <svg
                  className="w-4 h-4 text-rose-400 mt-0.5 shrink-0"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <div className="space-y-1 min-w-0">
                  <span className="text-sm text-gray-800 leading-snug">{label}</span>
                  {category && (
                    <span className="block text-xs font-medium text-rose-400 bg-rose-50 px-2 py-0.5 rounded-full w-fit">
                      {category}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isCustom && (
                  <span className="text-xs font-medium bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                    Custom
                  </span>
                )}
                <button
                  onClick={() => onRemove(row)}
                  className="text-gray-300 hover:text-rose-400 transition-colors text-lg leading-none"
                  aria-label="Remove question"
                >
                  ×
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function QuestionsForCardiologist() {
  const [grouped, setGrouped] = useState<GroupedQuestions>({})
  const [saved, setSaved] = useState<SavedQuestion[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [customText, setCustomText] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [
        { data: questions, error: qError },
        { data: savedRows, error: sError },
      ] = await Promise.all([
        supabase.from('cardiologist_questions').select('*').order('category'),
        supabase.from('saved_questions').select('*').eq('user_id', CURRENT_USER_ID),
      ])

      console.log('[load] cardiologist_questions:', { count: questions?.length, error: qError })
      console.log('[load] saved_questions:', { count: savedRows?.length, error: sError })

      if (questions && questions.length > 0) {
        const groups: GroupedQuestions = {}
        for (const q of questions as CardiologistQuestion[]) {
          const cat = q.category ?? 'General'
          if (!groups[cat]) groups[cat] = []
          groups[cat].push(q)
        }
        console.log('[load] grouped categories:', Object.keys(groups))
        setGrouped(groups)
      }

      if (savedRows) {
        setSaved(savedRows as SavedQuestion[])
        setSavedIds(new Set((savedRows as SavedQuestion[]).map((r) => String(r.question_id ?? ''))))
      }

      setLoading(false)
    }
    load()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function toggleQuestion(question: CardiologistQuestion) {
    if (savedIds.has(String(question.id))) {
      const { error } = await supabase
        .from('saved_questions')
        .delete()
        .eq('user_id', CURRENT_USER_ID)
        .eq('question_id', question.id)
      console.log('[toggleQuestion] delete:', { error })

      setSavedIds((prev) => {
        const next = new Set(prev)
        next.delete(String(question.id))
        return next
      })
      setSaved((prev) => prev.filter((r) => String(r.question_id) !== String(question.id)))
    } else {
      const row = { user_id: CURRENT_USER_ID, question_id: question.id, custom_text: null }
      const { data, error } = await supabase.from('saved_questions').upsert(row).select().single()
      console.log('[toggleQuestion] upsert:', { data, error })
      setSavedIds((prev) => new Set([...prev, String(question.id)]))
      if (data) setSaved((prev) => [...prev, data as SavedQuestion])
    }
  }

  async function addCustomQuestion() {
    if (!customText.trim()) return
    setAdding(true)
    const row = { user_id: CURRENT_USER_ID, question_id: null, custom_text: customText.trim() }
    const { data, error } = await supabase.from('saved_questions').insert(row).select().single()
    console.log('[addCustomQuestion]', { data, error })
    if (data) setSaved((prev) => [...prev, data as SavedQuestion])
    setCustomText('')
    setAdding(false)
  }

  async function removeQuestion(row: SavedQuestion) {
    const { error } = await supabase.from('saved_questions').delete().eq('id', row.id)
    console.log('[removeQuestion]', { error })
    setSaved((prev) => prev.filter((r) => r.id !== row.id))
    if (row.question_id) {
      setSavedIds((prev) => {
        const next = new Set(prev)
        next.delete(row.question_id!)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading questions...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="text-center mt-2 mb-6">
          <h1 className="text-3xl font-bold tracking-wide text-gray-900 leading-tight">
            Questions for Your
          </h1>
          <h1 className="text-3xl font-bold tracking-wide text-rose-500 leading-tight">
            Cardiologist
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Save questions to bring to your next appointment.
          </p>
        </div>

        {/* Search + Dropdown */}
        <div ref={containerRef} className="relative">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-300"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Search or browse questions..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-rose-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
            />
          </div>

          {dropdownOpen && (
            <QuestionDropdown
              grouped={grouped}
              searchQuery={searchQuery}
              savedIds={savedIds}
              customText={customText}
              adding={adding}
              onToggle={toggleQuestion}
              onCustomChange={setCustomText}
              onCustomSubmit={addCustomQuestion}
            />
          )}
        </div>

        {/* Saved Questions */}
        <SavedQuestionsList saved={saved} grouped={grouped} onRemove={removeQuestion} />

        {saved.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💗</div>
            <p className="text-sm text-gray-400">
              No saved questions yet. Search above to get started.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
