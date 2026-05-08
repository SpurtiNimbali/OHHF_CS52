import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, ensureAuthUserId, CardiologistQuestion, SavedQuestion } from '../lib/supabase'

const FILTER_CATEGORIES = ['Diagnosis', 'Treatment', 'Lifestyle', 'Monitoring'] as const
type FilterCategory = (typeof FILTER_CATEGORIES)[number]
type GroupedQuestions = Record<string, CardiologistQuestion[]>

/** Matches `welcomeScreen` age option labels; school age and younger vs older. */
const SCHOOL_AGE_OR_BELOW_LABELS = [
  'Prenatal',
  'Infant (1 and under)',
  'Preschooler (2-5)',
  'School Age (6-12)',
] as const

type UserProfileFields = {
  diagnosis_age_category: string | null
  current_age_category: string | null
  condition: string | null
}

function isSchoolAgeOrBelow(currentAgeCategory: string | null | undefined): boolean {
  if (!currentAgeCategory?.trim()) return false
  return (SCHOOL_AGE_OR_BELOW_LABELS as readonly string[]).includes(currentAgeCategory.trim())
}

/** Stored `condition` is comma-separated category titles from onboarding. */
function conditionIsGeneticOrMentalHealth(condition: string | null | undefined): boolean {
  if (!condition?.trim()) return false
  const c = condition.toLowerCase()
  return /\bgenetic\b/.test(c) || /mental health/.test(c)
}

/**
 * Placeholder rules (will be replaced later).
 * Age: school-or-below → Diagnosis/Treatment only; older → Lifestyle/Monitoring only.
 * Condition: Genetic or Mental Health → Diagnosis/Treatment; else → Lifestyle/Monitoring.
 */
function passesPersonalizationFilters(
  personalizeByAge: boolean,
  personalizeByCondition: boolean,
  profile: UserProfileFields | null,
  bucket: FilterCategory | 'other',
): boolean {
  const anyOn = personalizeByAge || personalizeByCondition
  if (!anyOn) return true
  if (bucket === 'other') return false

  const isDxOrTx = bucket === 'Diagnosis' || bucket === 'Treatment'
  const isLifeOrMon = bucket === 'Lifestyle' || bucket === 'Monitoring'

  let allowed = true

  if (personalizeByAge) {
    const age = profile?.current_age_category
    if (age?.trim()) {
      const below = isSchoolAgeOrBelow(age)
      const ageOk = below ? isDxOrTx : isLifeOrMon
      allowed = allowed && ageOk
    }
  }

  if (personalizeByCondition) {
    const cond = profile?.condition
    if (cond?.trim()) {
      const geneticOrMental = conditionIsGeneticOrMentalHealth(cond)
      const condOk = geneticOrMental ? isDxOrTx : isLifeOrMon
      allowed = allowed && condOk
    }
  }

  return allowed
}

const categoryColors: Record<
  FilterCategory | 'other',
  { bg: string; text: string; border: string }
> = {
  Diagnosis: { bg: '#fff3e0', text: '#e65100', border: '#ffcc80' },
  Treatment: { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
  Lifestyle: { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
  Monitoring: { bg: '#f3e5f5', text: '#6a1b9a', border: '#ce93d8' },
  other: { bg: '#fff8e1', text: '#f57f17', border: '#ffe082' },
}

function normalizeCategory(cat: string | null | undefined): FilterCategory | 'other' {
  const c = (cat ?? '').trim().toLowerCase()
  for (const label of FILTER_CATEGORIES) {
    if (label.toLowerCase() === c) return label
  }
  return 'other'
}

function categoryStyle(cat: FilterCategory | 'other') {
  return categoryColors[cat] ?? categoryColors.other
}

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
        border: '2px solid ' + (saved ? '#577568' : '#c6d9e5'),
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

  const totalQuestions = useMemo(
    () => Object.values(grouped).reduce((sum, list) => sum + (list?.length ?? 0), 0),
    [grouped],
  )
  const hasResults = Object.keys(filteredGroups).length > 0

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
    <section style={{ marginTop: '32px', marginBottom: '48px' }}>
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

export default function QuestionsForCardiologist() {
  const [questions, setQuestions] = useState<CardiologistQuestion[]>([])
  const [saved, setSaved] = useState<SavedQuestion[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [authBootstrapped, setAuthBootstrapped] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<FilterCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customText, setCustomText] = useState('')
  const [adding, setAdding] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfileFields | null>(null)
  const [personalizeByAge, setPersonalizeByAge] = useState(false)
  const [personalizeByCondition, setPersonalizeByCondition] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

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
    if (!dropdownOpen) return
    function onDocMouseDown(e: MouseEvent) {
      const el = containerRef.current
      if (el && !el.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [dropdownOpen])

  useEffect(() => {
    if (!authBootstrapped) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [authBootstrapped])

  const load = useCallback(async (uid: string | null) => {
    setLoading(true)
    setError(null)

    const questionsQuery = supabase
      .from('cardiologist_questions')
      .select('id, category, question_text')
      .order('category', { ascending: true })

    const savedQuery = uid
      ? supabase.from('saved_questions').select('*').eq('user_id', uid)
      : Promise.resolve({ data: [] as SavedQuestion[], error: null })

    const profileQuery = uid
      ? supabase
          .from('users')
          .select('diagnosis_age_category, current_age_category, condition')
          .eq('id', uid)
          .maybeSingle()
      : Promise.resolve({ data: null as UserProfileFields | null, error: null })

    const [
      { data: rows, error: qError },
      { data: savedRows, error: sError },
      { data: profileRow, error: profileError },
    ] = await Promise.all([questionsQuery, savedQuery, profileQuery])

    if (!profileError && profileRow) {
      setUserProfile(profileRow as UserProfileFields)
    } else {
      setUserProfile(null)
    }

    if (qError) {
      setQuestions([])
      setError(qError.message)
    } else {
      setQuestions((rows as CardiologistQuestion[]) ?? [])
    }

    if (!qError && sError) {
      setError((prev) => prev ?? sError.message)
    }

    if (savedRows) {
      setSaved(savedRows as SavedQuestion[])
      setSavedIds(
        new Set(
          (savedRows as SavedQuestion[])
            .filter((r) => r.question_id != null)
            .map((r) => String(r.question_id)),
        ),
      )
    } else if (!uid) {
      setSaved([])
      setSavedIds(new Set())
    }

    if (!uid && !qError) {
      setError((prev) => prev ?? 'Sign in to save questions for your account.')
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authBootstrapped) return
    load(userId)
  }, [authBootstrapped, userId, load])

  const grouped = useMemo(() => {
    const groups: GroupedQuestions = {}
    for (const q of questions) {
      const cat = (q.category ?? 'General').trim() || 'General'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(q)
    }
    return groups
  }, [questions])

  const filteredQuestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return questions.filter((row) => {
      const text = (row.question_text ?? '').toLowerCase()
      if (q && !text.includes(q)) return false
      if (!selectedTag) return true
      return normalizeCategory(row.category) === selectedTag
    })
  }, [questions, query, selectedTag])

  const personalizedQuestions = useMemo(() => {
    return filteredQuestions.filter((row) => {
      const bucket = normalizeCategory(row.category)
      return passesPersonalizationFilters(
        personalizeByAge,
        personalizeByCondition,
        userProfile,
        bucket,
      )
    })
  }, [filteredQuestions, personalizeByAge, personalizeByCondition, userProfile])

  async function toggleQuestion(question: CardiologistQuestion) {
    if (!userId) {
      setError('Sign in to save questions for your account.')
      return
    }
    const idStr = String(question.id)
    if (savedIds.has(idStr)) {
      const { error: delErr } = await supabase
        .from('saved_questions')
        .delete()
        .eq('user_id', userId)
        .eq('question_id', question.id)
      if (delErr) return

      setSavedIds((prev) => {
        const next = new Set(prev)
        next.delete(idStr)
        return next
      })
      setSaved((prev) => prev.filter((r) => String(r.question_id) !== idStr))
    } else {
      const row = { user_id: userId, question_id: question.id, custom_text: null }
      const { data, error: upErr } = await supabase
        .from('saved_questions')
        .upsert(row)
        .select()
        .single()
      if (upErr) return

      setSavedIds((prev) => new Set([...prev, idStr]))
      if (data) setSaved((prev) => [...prev, data as SavedQuestion])
    }
  }

  async function addCustomQuestion() {
    if (!userId) {
      setError('Sign in to save questions for your account.')
      return
    }
    if (!customText.trim()) return
    setAdding(true)
    const row = { user_id: userId, question_id: null, custom_text: customText.trim() }
    const { data, error: insErr } = await supabase.from('saved_questions').insert(row).select().single()
    if (!insErr && data) setSaved((prev) => [...prev, data as SavedQuestion])
    setCustomText('')
    setAdding(false)
  }

  async function removeQuestion(row: SavedQuestion) {
    const { error: delErr } = await supabase.from('saved_questions').delete().eq('id', row.id)
    if (delErr) return

    setSaved((prev) => prev.filter((r) => r.id !== row.id))
    if (row.question_id) {
      setSavedIds((prev) => {
        const next = new Set(prev)
        next.delete(String(row.question_id))
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

        {/* Search + browse dropdown */}
        <div ref={containerRef} style={{ position: 'relative', marginBottom: '24px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#acb7a8', fontSize: '0.9rem' }}>
              🔍
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
              searchQuery={query}
              savedIds={savedIds}
              customText={customText}
              adding={adding}
              onToggle={toggleQuestion}
              onCustomChange={setCustomText}
              onCustomSubmit={addCustomQuestion}
            />
          )}
        </div>

        {/* Topic chips */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{
            fontSize: '0.85rem',
            color: '#577568',
            marginBottom: '10px',
            fontWeight: 600,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            Filter by topic
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              style={{
                padding: '8px 16px',
                borderRadius: '100px',
                border: selectedTag === null ? 'none' : '1.5px solid #c6d9e5',
                background: selectedTag === null ? '#577568' : '#fff',
                color: selectedTag === null ? '#f5f9f9' : '#577568',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              All
            </button>
            {FILTER_CATEGORIES.map((cat) => {
              const colors = categoryColors[cat]
              const isSelected = selectedTag === cat
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedTag(isSelected ? null : cat)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '100px',
                    border: isSelected ? 'none' : '1.5px solid ' + colors.border,
                    background: isSelected ? colors.text : colors.bg,
                    color: isSelected ? '#fff' : colors.text,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* Personalize (from profile) */}
        <div style={{ marginBottom: '28px', paddingTop: '20px', borderTop: '1px solid #c6d9e5' }}>
          <p style={{
            fontSize: '0.85rem',
            color: '#577568',
            marginBottom: '12px',
            fontWeight: 600,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            Personalize from your profile
          </p>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            marginBottom: '10px',
            fontSize: '0.9rem',
            color: '#192b3f',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            <input
              type="checkbox"
              checked={personalizeByAge}
              onChange={(e) => setPersonalizeByAge(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#577568' }}
            />
            Related to age
          </label>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: '#192b3f',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            <input
              type="checkbox"
              checked={personalizeByCondition}
              onChange={(e) => setPersonalizeByCondition(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#577568' }}
            />
            Related to condition
          </label>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: '#c6d9e5', marginBottom: '32px' }} />

        {!loading && error && (
          <div
            style={{
              background: '#fff8e1',
              border: '2px solid #ffe082',
              borderRadius: '16px',
              padding: '20px 24px',
              marginBottom: '24px',
            }}
          >
            <p style={{ margin: 0, color: '#b45309', fontSize: '0.9rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
              {error}
            </p>
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#acb7a8', fontSize: '0.9rem' }}>
            No questions in the database yet.
          </div>
        )}

        {/* Saved Questions */}
        <SavedQuestionsList saved={saved} grouped={grouped} onRemove={removeQuestion} />

        {!loading && !error && saved.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💗</div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#acb7a8' }}>
              No saved questions yet. Search above to get started.
            </p>
          </div>
        )}

        {!loading && !error && questions.length > 0 && filteredQuestions.length === 0 && (
          <div
            style={{
              background: '#fff8e1',
              border: '2px solid #ffe082',
              borderRadius: '16px',
              padding: '40px 24px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '3rem' }}>🔍</span>
            <p style={{ color: '#f57f17', fontSize: '1.2rem', fontWeight: 600, marginTop: '12px' }}>
              {selectedTag ? 'No ' + selectedTag + ' questions match' : 'No questions match your search'}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          questions.length > 0 &&
          filteredQuestions.length > 0 &&
          personalizedQuestions.length === 0 && (
            <div
              style={{
                background: '#fff8e1',
                border: '2px solid #ffe082',
                borderRadius: '16px',
                padding: '40px 24px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '3rem' }}>✨</span>
              <p style={{ color: '#f57f17', fontSize: '1.2rem', fontWeight: 600, marginTop: '12px' }}>
                No questions match your personalization settings
              </p>
              <p style={{ color: '#b45309', fontSize: '0.95rem', marginTop: '8px', lineHeight: 1.5 }}>
                Try turning off the age or condition options above, or adjust your topic filter.
              </p>
            </div>
          )}

        {!loading && !error && personalizedQuestions.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
            }}
          >
            {personalizedQuestions.map((question, index) => {
              const bucket = normalizeCategory(question.category)
              const displayCat = bucket === 'other' ? question.category?.trim() || 'General' : bucket
              const colors = categoryStyle(bucket)

              return (
                <div
                  key={question.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    padding: '24px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    border: '2px solid transparent',
                    transition: 'all 0.3s ease',
                    animation: 'fadeInUp 0.5s ease ' + String(index * 0.04) + 's both',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)'
                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(87,117,104,0.2)'
                    e.currentTarget.style.borderColor = colors.border
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
                    e.currentTarget.style.borderColor = 'transparent'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                      marginBottom: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-block',
                        background: colors.bg,
                        color: colors.text,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        border: '1px solid ' + colors.border,
                      }}
                    >
                      {displayCat}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleQuestion(question)}
                      aria-label={savedIds.has(String(question.id)) ? 'Remove from saved' : 'Save question'}
                      style={{
                        border: 'none',
                        background: savedIds.has(String(question.id)) ? '#fce7f3' : '#f3f4f6',
                        borderRadius: '12px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        lineHeight: 1,
                      }}
                    >
                      {savedIds.has(String(question.id)) ? '❤️' : '🤍'}
                    </button>
                  </div>

                  <p
                    style={{
                      color: '#2c3e50',
                      fontSize: '1.05rem',
                      lineHeight: 1.55,
                      margin: 0,
                      fontWeight: 500,
                    }}
                  >
                    {question.question_text}
                  </p>

                  <div
                    style={{
                      marginTop: '16px',
                      height: '4px',
                      background: 'linear-gradient(90deg, ' + colors.border + ', ' + colors.bg + ')',
                      borderRadius: '2px',
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}

        {!loading && !error && personalizedQuestions.length > 0 && (
          <p
            style={{
              textAlign: 'center',
              color: '#888',
              marginTop: '30px',
              fontSize: '0.9rem',
            }}
          >
            Showing {personalizedQuestions.length} question{personalizedQuestions.length !== 1 ? 's' : ''}
            {selectedTag ? ' in ' + selectedTag : ''}
            {(personalizeByAge || personalizeByCondition) && ' (personalized)'}
          </p>
        )}

        {!loading && !error && saved.length === 0 && questions.length > 0 && (
          <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: '24px', fontSize: '0.9rem' }}>
            Tap the heart on a card to save it for your visit.
          </p>
        )}
      </div>
    </div>
  )
}
