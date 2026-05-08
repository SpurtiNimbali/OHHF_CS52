import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Bookmark, ChevronDown, Plus, Trash2 } from 'lucide-react'
import {
  ResourcesPageError,
  ResourcesPageLoading,
} from '../components/ResourcesPageStates'
import { DashedEmptyNotice } from '../components/ui/dashedEmptyNotice'
import { InlineAlertBanner } from '../components/ui/inlineAlertBanner'
import { NavyToggleChip } from '../components/ui/navyToggleChip'
import { QuestionTopicBadge } from '../components/ui/questionTopicBadge'
import { supabase, ensureAuthUserId, CardiologistQuestion, SavedQuestion } from '../lib/supabase'
import {
  CARDEA_ALMOST_WHITE,
  CARDEA_DARK_GREEN,
  CARDEA_LIGHT_BLUE,
  CARDEA_MUTED,
  CARDEA_NAVY,
} from '../ui/cardeaTokens'

const SIGN_IN_TO_SAVE_HINT = 'Sign in to save questions for your account.'

const META_STORAGE_PREFIX = 'cardea-saved-q-meta'

/** Visit context chips for generation (templates + filtering). Custom question tags use bank categories instead. */
const VISIT_CONTEXT_FILTERS = [
  'Surgery or procedure',
  'New diagnosis',
  'Routine follow-up',
  'Medications',
  'Test results',
  'Lifestyle & wellbeing',
  'Symptoms & concerns',
  'Family history & genetics',
  'Prevention & heart health',
  'Care coordination & referrals',
] as const

const FILTER_CATEGORIES = ['Diagnosis', 'Treatment', 'Lifestyle', 'Monitoring'] as const
type FilterCategory = (typeof FILTER_CATEGORIES)[number]
type GroupedQuestions = Record<string, CardiologistQuestion[]>

type SavedQuestionMeta = {
  source: 'generated' | 'custom' | 'bank'
  contextTags: string[]
  notes: string
}

function metaStorageKey(userId: string | null): string {
  return userId ? `${META_STORAGE_PREFIX}:${userId}` : `${META_STORAGE_PREFIX}:anon`
}

function normalizeStoredMeta(raw: unknown): Record<string, SavedQuestionMeta> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, SavedQuestionMeta> = {}
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const source = e.source
    if (source !== 'generated' && source !== 'custom' && source !== 'bank') continue
    const notes = typeof e.notes === 'string' ? e.notes : ''
    const contextTags = Array.isArray(e.contextTags)
      ? e.contextTags.filter((t): t is string => typeof t === 'string')
      : []
    out[id] = { source: source as SavedQuestionMeta['source'], contextTags, notes }
  }
  return out
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

function scoreBankQuestion(
  q: CardiologistQuestion,
  ctxTokens: Set<string>,
  filters: Set<VisitFilter>,
): number {
  let score = 0
  const text = `${q.question_text ?? ''} ${q.category ?? ''}`.toLowerCase()
  const cat = (q.category ?? '').toLowerCase()

  for (const f of filters) {
    const fLow = f.toLowerCase()
    if (text.includes(fLow) || cat.includes(fLow.split(' ')[0])) score += 3
    const words = fLow.split(/[^a-z]+/)
    for (const w of words) {
      if (w.length > 2 && text.includes(w)) score += 1
    }
    return result
  }, [grouped, q])

  const totalQuestions = useMemo(
    () => Object.values(grouped).reduce((sum, list) => sum + (list?.length ?? 0), 0),
    [grouped],
  )
  const hasResults = Object.keys(filteredGroups).length > 0

  for (const t of ctxTokens) {
    if (text.includes(t)) score += 2
  }

  return score
}

function pickFilterForQuestion(
  q: CardiologistQuestion,
  filters: Set<VisitFilter>,
): VisitFilter | 'General' {
  if (filters.size === 1) return [...filters][0]
  const text = `${q.question_text} ${q.category}`.toLowerCase()
  for (const f of filters) {
    if (text.includes(f.toLowerCase().slice(0, 8))) return f
  }
  const first = [...filters][0]
  return first ?? 'General'
}

function generateSuggestions(
  visitContext: string,
  filters: Set<VisitFilter>,
  bank: CardiologistQuestion[],
): GeneratedItem[] {
  const ctxTokens = tokenize(visitContext)
  const out: GeneratedItem[] = []
  const seen = new Set<string>()

  const add = (text: string, filter: VisitFilter | 'General') => {
    const k = text.trim().toLowerCase()
    if (!k || seen.has(k)) return
    seen.add(k)
    out.push({
      tempId: `g-${seen.size}-${Math.random().toString(36).slice(2, 9)}`,
      text: text.trim(),
      filter,
    })
  }

  for (const f of filters) {
    const temps = FILTER_TEMPLATES[f]
    if (temps) {
      for (const t of temps) {
        add(t, f)
        if (out.length >= 14) break
      }
    }
    if (out.length >= 14) break
  }

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

  const scored = bank
    .map((q) => ({ q, s: scoreBankQuestion(q, ctxTokens, filters) }))
    .filter(({ s }) => s > 0 || filters.size === 0)
    .sort((a, b) => b.s - a.s)

  for (const { q } of scored) {
    if (out.length >= 12) break
    const filt = filters.size ? pickFilterForQuestion(q, filters) : 'General'
    add(q.question_text, filt)
  }

  return out.slice(0, 10)
}

function distinctBankCategories(bank: CardiologistQuestion[]): string[] {
  const seen = new Set<string>()
  for (const q of bank) {
    const c = q.category?.trim()
    if (c) seen.add(c)
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

function getSavedLabel(row: SavedQuestion, bank: CardiologistQuestion[]): string {
  if (row.custom_text?.trim()) return row.custom_text.trim()
  const m = bank.find((q) => String(q.id) === String(row.question_id))
  return m?.question_text ?? 'Saved question'
}

export default function QuestionsForCardiologist() {
  const [questions, setQuestions] = useState<CardiologistQuestion[]>([])
  const [saved, setSaved] = useState<SavedQuestion[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [authBootstrapped, setAuthBootstrapped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [visitContext, setVisitContext] = useState('')
  const [selectedFilters, setSelectedFilters] = useState<Set<VisitFilter>>(new Set())
  const [generated, setGenerated] = useState<GeneratedItem[]>([])
  const [generating, setGenerating] = useState(false)

  const [customLine, setCustomLine] = useState('')
  const [adding, setAdding] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customQuestionTags, setCustomQuestionTags] = useState<Set<string>>(new Set())
  const bankCategoryTags = useMemo(() => distinctBankCategories(questions), [questions])

  const containerRef = useRef<HTMLDivElement>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    const valid = new Set(bankCategoryTags)
    setCustomQuestionTags((prev) => {
      const filtered = [...prev].filter((t) => valid.has(t))
      if (filtered.length === prev.size && filtered.every((t) => prev.has(t))) return prev
      return new Set(filtered)
    })
  }, [bankCategoryTags])
  const customInputRef = useRef<HTMLInputElement>(null)
  const [expandedSavedId, setExpandedSavedId] = useState<string | null>(null)
  const [savedMeta, setSavedMeta] = useState<Record<string, SavedQuestionMeta>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const uid = await ensureAuthUserId()
        if (!cancelled) setUserId(uid)
      } catch {
        if (!cancelled) setUserId(null)
      } finally {
        if (!cancelled) setAuthBootstrapped(true)
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
    setSavedMeta(loadAllMeta(userId))
  }, [authBootstrapped, userId])

  useEffect(() => {
    if (!authBootstrapped) return
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [authBootstrapped])

  useEffect(() => {
    if (showCustomForm) {
      window.requestAnimationFrame(() => customInputRef.current?.focus())
    }
  }, [showCustomForm])

  const patchMeta = useCallback(
    (savedId: string, patch: Partial<SavedQuestionMeta>) => {
      setSavedMeta((prev) => {
        const base = prev[savedId] ?? { source: 'custom', contextTags: [], notes: '' }
        const next = { ...prev, [savedId]: { ...base, ...patch } }
        persistAllMeta(userId, next)
        return next
      })
    },
    [userId],
  )

  const load = useCallback(async (uid: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const questionsQuery = supabase
        .from('cardiologist_questions')
        .select('id, category, question_text')
        .order('category', { ascending: true })

      const savedQuery = uid
        ? supabase.from('saved_questions').select('*').eq('user_id', uid)
        : Promise.resolve({ data: [] as SavedQuestion[], error: null })

      const [{ data: rows, error: qError }, { data: savedRows, error: sError }] = await Promise.all([
        questionsQuery,
        savedQuery,
      ])

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
      } else if (!uid) {
        setSaved([])
      }

      if (!uid && !qError) {
        setError((prev) => prev ?? SIGN_IN_TO_SAVE_HINT)
      }
    } catch (e) {
      setQuestions([])
      setSaved([])
      setError(e instanceof Error ? e.message : 'Could not load questions.')
    } finally {
      setLoading(false)
    }
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
  const toggleFilter = (f: VisitFilter) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  const toggleCustomQuestionTag = (tag: string) => {
    setCustomQuestionTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const runGenerate = () => {
    setGenerating(true)
    window.setTimeout(() => {
      const list = generateSuggestions(visitContext, selectedFilters, questions)
      setGenerated(list)
      setGenerating(false)
      if (list.length > 0) {
        window.setTimeout(() => {
          document.getElementById('suggested-questions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 50)
      }
    }, 380)
  }

  async function saveGeneratedLine(text: string, filter: VisitFilter | 'General') {
    if (!userId) {
      setError(SIGN_IN_TO_SAVE_HINT)
      return
    }
    const row = { user_id: userId, question_id: null, custom_text: text.trim() }
    const { data, error: insErr } = await supabase.from('saved_questions').insert(row).select().single()
    if (insErr) {
      setError(insErr.message)
      return
    }
    if (data) {
      const s = data as SavedQuestion
      setSaved((prev) => [...prev, s])
      setSavedMeta((prev) => {
        const next = {
          ...prev,
          [s.id]: {
            source: 'generated' as const,
            contextTags: [filter],
            notes: '',
          },
        }
        persistAllMeta(userId, next)
        return next
      })
    }
  }

  async function saveCustomQuestion() {
    if (!userId) {
      setError(SIGN_IN_TO_SAVE_HINT)
      return
    }
    if (!customLine.trim()) return
    setAdding(true)
    const row = { user_id: userId, question_id: null, custom_text: customLine.trim() }
    const { data, error: insErr } = await supabase.from('saved_questions').insert(row).select().single()
    if (insErr) {
      setError(insErr.message)
      setAdding(false)
      return
    }
    if (data) {
      const s = data as SavedQuestion
      setSaved((prev) => [...prev, s])
      setSavedMeta((prev) => {
        const next = {
          ...prev,
          [s.id]: {
            source: 'custom' as const,
            contextTags: [...customQuestionTags],
            notes: '',
          },
        }
        persistAllMeta(userId, next)
        return next
      })
    }
    setCustomLine('')
    setCustomQuestionTags(new Set())
    setShowCustomForm(false)
    setAdding(false)
  }

  async function removeQuestion(row: SavedQuestion) {
    const { error: delErr } = await supabase.from('saved_questions').delete().eq('id', row.id)
    if (delErr) return

    setSaved((prev) => prev.filter((r) => r.id !== row.id))
    setSavedMeta((prev) => {
      const next = { ...prev }
      delete next[row.id]
      persistAllMeta(userId, next)
      return next
    })
    if (expandedSavedId === row.id) setExpandedSavedId(null)
  }

  const savedBadge = useCallback(
    (item: SavedQuestion): { label: string } => {
      const meta = savedMeta[item.id]
      const tags = Array.isArray(meta?.contextTags)
        ? meta.contextTags.filter((t): t is string => typeof t === 'string')
        : []
      if (meta?.source === 'generated') {
        return { label: tags[0] ?? 'General' }
      }
      if (meta?.source === 'custom') {
        return {
          label: tags.length ? tags.join(' · ') : 'General',
        }
      }
      if (!item.question_id) {
        return {
          label: tags.length ? tags.join(' · ') : 'General',
        }
      }
      if (tags.length) return { label: tags[0] }
      const cat = questions.find((q) => String(q.id) === String(item.question_id))?.category?.trim()
      if (cat) return { label: cat }
      return { label: 'Saved' }
    },
    [savedMeta, questions],
  )

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#acb7a8', fontSize: '0.9rem', fontFamily: 'Inter, system-ui, sans-serif' }}>Loading questions…</p>
      </div>
    )
  }

  const blockingLoadError =
    Boolean(error) && questions.length === 0 && error !== SIGN_IN_TO_SAVE_HINT

  if (blockingLoadError && error) {
    return (
      <ResourcesPageError message={error} onRetry={() => load(userId)} />
    )
  }

  return (
    <div className="-mx-2 w-full sm:mx-0" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: CARDEA_NAVY }}>
      {/* Header */}
      <div
        className="mb-0 rounded-t-xl border-b bg-white px-3 py-6 sm:rounded-none sm:px-4 sm:py-8"
        style={{ borderColor: 'rgba(25, 43, 63, 0.1)' }}
      >
        <h1
          className="mb-2 text-3xl tracking-wide text-[#192b3f] sm:text-4xl md:text-5xl"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}
        >
          QUESTIONS FOR YOUR CARDIOLOGIST
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: CARDEA_MUTED }}>
          Describe your upcoming visit and we&apos;ll suggest questions to ask — or add your own.
        </p>
      </div>

      {/* Visit context */}
      <div
        className="border-b px-3 py-6 sm:px-4"
        style={{
          borderColor: 'rgba(25, 43, 63, 0.08)',
          background: 'linear-gradient(90deg, rgba(198,217,229,0.35) 0%, rgba(245,249,249,0.95) 100%)',
        }}
      >
        <div className="mx-auto max-w-3xl space-y-4">
          <label className="sr-only" htmlFor="visit-context">
            Visit notes
          </label>
          <textarea
            id="visit-context"
            rows={4}
            value={visitContext}
            onChange={(e) => setVisitContext(e.target.value)}
            placeholder="I have an appointment tomorrow. I want to discuss…"
            className="min-h-[7.5rem] w-full resize-y rounded-xl border-2 bg-white/95 px-4 py-3 text-sm text-[#192b3f] outline-none focus:ring-2 sm:text-base"
            style={{ borderColor: CARDEA_LIGHT_BLUE, boxShadow: '0 2px 12px rgba(25, 43, 63, 0.06)' }}
          />

          <button
            type="button"
            disabled={generating}
            onClick={runGenerate}
            className="w-full rounded-xl px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-60 sm:w-auto sm:min-w-[200px]"
            style={{ background: CARDEA_DARK_GREEN }}
          >
            {generating ? 'Generating…' : 'Generate Questions'}
          </button>

          <button
            type="button"
            onClick={() => setShowCustomForm((open) => !open)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 bg-white/90 py-3 text-sm font-semibold shadow-sm transition-colors hover:bg-white sm:justify-start sm:px-4"
            style={{ borderColor: CARDEA_DARK_GREEN, color: CARDEA_DARK_GREEN }}
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            {showCustomForm ? 'Close — add your own question' : 'Add your own question'}
          </button>

          <AnimatePresence initial={false}>
            {showCustomForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden rounded-xl border-2 bg-white p-4 shadow-sm"
                style={{ borderColor: CARDEA_DARK_GREEN }}
              >
                <label htmlFor="custom-q-inline" className="mb-2 block text-sm font-semibold text-[#192b3f]">
                  Have a specific question in mind?
                </label>
                <input
                  ref={customInputRef}
                  id="custom-q-inline"
                  type="text"
                  value={customLine}
                  onChange={(e) => setCustomLine(e.target.value)}
                  placeholder="Type your question…"
                  className="mb-3 w-full rounded-lg border px-4 py-2.5 text-sm text-[#192b3f] outline-none"
                  style={{ borderColor: CARDEA_LIGHT_BLUE }}
                />
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: CARDEA_MUTED }}>
                  Tags (optional)
                </p>
                <p className="mb-3 text-xs leading-snug" style={{ color: CARDEA_MUTED }}>
                  Categories from the question library — same labels as on saved questions.
                </p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {bankCategoryTags.length === 0 ? (
                    <p className="text-xs italic" style={{ color: CARDEA_MUTED }}>
                      No categories are available in the question library yet.
                    </p>
                  ) : (
                    bankCategoryTags.map((tag) => (
                      <NavyToggleChip
                        key={`custom-tag-${tag}`}
                        selected={customQuestionTags.has(tag)}
                        onClick={() => toggleCustomQuestionTag(tag)}
                      >
                        {tag}
                      </NavyToggleChip>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={adding || !customLine.trim()}
                    onClick={saveCustomQuestion}
                    className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: CARDEA_DARK_GREEN }}
                  >
                    Save question
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomForm(false)
                      setCustomLine('')
                      setCustomQuestionTags(new Set())
                    }}
                    className="rounded-lg bg-[#e8ecec] px-4 py-2.5 text-sm font-medium text-[#192b3f] hover:bg-[#dce2e2]"
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
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: CARDEA_MUTED }}>
              My visit context:
            </p>
            <div className="flex flex-wrap gap-2">
              {VISIT_CONTEXT_FILTERS.map((f) => (
                <NavyToggleChip key={f} selected={selectedFilters.has(f)} onClick={() => toggleFilter(f)}>
                  {f}
                </NavyToggleChip>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && <InlineAlertBanner>{error}</InlineAlertBanner>}

      {/* Saved */}
      <div className="px-3 py-8 sm:px-4">
        <div className="mb-4 flex items-center gap-2">
          <Bookmark className="h-5 w-5 shrink-0" style={{ color: CARDEA_DARK_GREEN }} />
          <h2 className="text-lg font-semibold text-[#192b3f]">Saved questions ({saved.length})</h2>
        </div>

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
        {saved.length === 0 ? (
          <DashedEmptyNotice>
            No saved questions yet. Generate suggestions or add your own below.
          </DashedEmptyNotice>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {saved.map((item, index) => {
                const label = getSavedLabel(item, questions)
                const badge = savedBadge(item)
                const open = expandedSavedId === item.id
                const notes = savedMeta[item.id]?.notes ?? ''

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="overflow-hidden rounded-xl border bg-white"
                    style={{ borderColor: 'rgba(25, 43, 63, 0.1)' }}
                  >
                    <div className="flex items-start gap-2 px-3 py-3 sm:px-4 sm:py-4">
                      <button
                        type="button"
                        onClick={() => setExpandedSavedId(open ? null : item.id)}
                        className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      >
                        <ChevronDown
                          className={`mt-0.5 h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                          style={{ color: CARDEA_MUTED }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug text-[#192b3f] sm:text-base">{label}</p>
                          <QuestionTopicBadge label={badge.label} accent="saved" />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(item)}
                        className="shrink-0 rounded-lg p-2 text-[#acb7a8] transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove question"
                      >
                        <Trash2 className="h-5 w-5" strokeWidth={2} />
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t"
                          style={{ borderColor: 'rgba(25, 43, 63, 0.08)' }}
                        >
                          <div className="bg-[#f5f9f9]/90 px-3 py-4 sm:px-4">
                            <label className="mb-1 block text-xs font-semibold text-[#192b3f]">Notes</label>
                            <textarea
                              value={notes}
                              onChange={(e) => patchMeta(item.id, { notes: e.target.value })}
                              placeholder="Doctor's answer, follow-up thoughts…"
                              rows={3}
                              className="w-full resize-y rounded-lg border px-3 py-2 text-sm text-[#192b3f] outline-none"
                              style={{ borderColor: CARDEA_LIGHT_BLUE }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Generated */}
      <AnimatePresence>
        {generated.length > 0 && (
          <motion.section
            id="suggested-questions"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="scroll-mt-4 border-t px-3 py-8 sm:px-4 sm:scroll-mt-6"
            style={{ borderColor: 'rgba(25, 43, 63, 0.08)', background: CARDEA_ALMOST_WHITE }}
          >
            <h2 className="mb-1 text-lg font-semibold text-[#192b3f]">Suggested for your visit</h2>
            <p className="mb-5 max-w-2xl text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
              Based on what you shared. Tap to save any question.
            </p>
            <ul className="mx-auto max-w-3xl space-y-3">
              {generated.map((g) => (
                <li
                  key={g.tempId}
                  className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderColor: 'rgba(25, 43, 63, 0.1)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-[#192b3f]">{g.text}</p>
                    <QuestionTopicBadge label={String(g.filter)} accent="suggested" />
                  </div>
                  <button
                    type="button"
                    onClick={() => saveGeneratedLine(g.text, g.filter)}
                    className="shrink-0 rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors"
                    style={{ borderColor: CARDEA_DARK_GREEN, color: CARDEA_DARK_GREEN }}
                  >
                    + Save
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
