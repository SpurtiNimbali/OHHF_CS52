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
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '10px 16px',
        background: hovered ? '#f5f9f9' : 'transparent',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Checkbox */}
      <div style={{
        marginTop: '2px',
        width: '18px',
        height: '18px',
        borderRadius: '5px',
        border: `2px solid ${saved ? '#577568' : '#c6d9e5'}`,
        background: saved ? '#577568' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.15s ease',
      }}>
        {saved && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f5f9f9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span style={{ fontSize: '0.875rem', color: '#192b3f', lineHeight: 1.55, fontFamily: 'Inter, system-ui, sans-serif' }}>
        {question.question_text}
      </span>
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
        ? questions.filter((question) => (question.question_text ?? '').toLowerCase().includes(q))
        : questions
      if (matches.length > 0) result[category] = matches
    }
    return result
  }, [grouped, q])

  const hasResults = Object.keys(filteredGroups).length > 0
  const totalQuestions = Object.values(grouped).flat().length

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 8px)',
      left: 0,
      right: 0,
      zIndex: 50,
      background: '#fff',
      border: '1.5px solid #c6d9e5',
      borderRadius: '14px',
      boxShadow: '0 12px 32px rgba(25,43,63,0.12)',
      overflow: 'hidden',
    }}>
      {totalQuestions === 0 && (
        <div style={{ padding: '10px 16px', background: '#fefce8', borderBottom: '1px solid #fde68a' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400e' }}>
            ⚠ No questions loaded — check console for fetch errors
          </p>
        </div>
      )}

      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        {hasResults ? (
          Object.entries(filteredGroups).map(([category, questions]) => (
            <div key={category}>
              <p style={{
                margin: 0,
                padding: '10px 16px 4px',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#577568',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
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
          <p style={{ padding: '24px', textAlign: 'center', fontSize: '0.875rem', color: '#acb7a8', margin: 0 }}>
            {totalQuestions === 0 ? 'No questions available.' : 'No questions match your search.'}
          </p>
        )}

        {/* Add your own */}
        <div
          onMouseDown={(e) => e.preventDefault()}
          style={{
            borderTop: '1px solid #c6d9e5',
            padding: '14px 16px',
            background: '#f5f9f9',
          }}
        >
          <p style={{
            margin: '0 0 8px',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: '#577568',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            Add your own question
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={customText}
              onChange={(e) => onCustomChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onCustomSubmit()}
              placeholder="Type your question..."
              style={{
                flex: 1,
                padding: '9px 13px',
                borderRadius: '10px',
                border: '1.5px solid #c6d9e5',
                background: '#fff',
                fontSize: '0.875rem',
                color: '#192b3f',
                fontFamily: 'Inter, system-ui, sans-serif',
                outline: 'none',
              }}
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCustomSubmit}
              disabled={adding || !customText.trim()}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                border: 'none',
                background: adding || !customText.trim() ? '#c6d9e5' : '#577568',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: adding || !customText.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'background 0.15s ease',
                whiteSpace: 'nowrap',
              }}
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
    <section style={{ marginTop: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <span style={{ color: '#577568', fontSize: '1rem' }}>♥</span>
        <h2 style={{
          margin: 0,
          fontFamily: 'var(--font-display, "Bebas Neue", sans-serif)',
          fontSize: '1.4rem',
          letterSpacing: '0.05em',
          color: '#192b3f',
        }}>
          Saved Questions ({saved.length})
        </h2>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                background: '#fff',
                border: '1.5px solid #c6d9e5',
                borderRadius: '12px',
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
                <svg style={{ width: '14px', height: '14px', color: '#577568', marginTop: '3px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="#577568" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
                  <span style={{ fontSize: '0.875rem', color: '#192b3f', lineHeight: 1.5, fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {label}
                  </span>
                  {category && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: '#c6d9e5',
                      color: '#192b3f',
                      padding: '2px 9px',
                      borderRadius: '100px',
                      width: 'fit-content',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      letterSpacing: '0.01em',
                    }}>
                      {category}
                    </span>
                  )}
                  {isCustom && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: '#f5f9f9',
                      color: '#577568',
                      border: '1px solid #c6d9e5',
                      padding: '2px 9px',
                      borderRadius: '100px',
                      width: 'fit-content',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}>
                      Custom
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onRemove(row)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#c6d9e5',
                  fontSize: '1.2rem',
                  lineHeight: 1,
                  padding: '0',
                  flexShrink: 0,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#577568')}
                onMouseLeave={e => (e.currentTarget.style.color = '#c6d9e5')}
                aria-label="Remove question"
              >
                ×
              </button>
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
      <div style={{ minHeight: '100vh', background: '#f5f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#acb7a8', fontSize: '0.9rem', fontFamily: 'Inter, system-ui, sans-serif' }}>Loading questions…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f9f9', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 24px 72px' }}>

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
            Questions for Your Cardiologist
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#acb7a8', lineHeight: 1.65, fontFamily: 'Inter, system-ui, sans-serif' }}>
            Save questions to bring to your next appointment.
          </p>
        </div>

        {/* Search + Dropdown */}
        <div ref={containerRef} style={{ position: 'relative', marginBottom: '32px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#acb7a8', fontSize: '0.9rem' }}>
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Search or browse questions…"
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

        {/* Divider */}
        <div style={{ height: '1px', background: '#c6d9e5', marginBottom: '32px' }} />

        {/* Saved Questions */}
        <SavedQuestionsList saved={saved} grouped={grouped} onRemove={removeQuestion} />

        {saved.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💗</div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#acb7a8' }}>
              No saved questions yet. Search above to get started.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
