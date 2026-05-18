import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Bookmark, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { supabase, ensureAuthUserId, CardiologistQuestion, SavedQuestion } from '../lib/supabase'

const NAVY = '#192b3f'
const LIGHT_BLUE = '#c6d9e5'
const ALMOST_WHITE = '#f5f9f9'
const DARK_GREEN = '#577568'
const MUTED_GREEN = '#acb7a8'

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

type VisitFilter = (typeof VISIT_CONTEXT_FILTERS)[number]

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

function loadAllMeta(userId: string | null): Record<string, SavedQuestionMeta> {
  try {
    const raw = localStorage.getItem(metaStorageKey(userId))
    if (!raw) return {}
    return normalizeStoredMeta(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

function persistAllMeta(userId: string | null, meta: Record<string, SavedQuestionMeta>) {
  try {
    localStorage.setItem(metaStorageKey(userId), JSON.stringify(meta))
  } catch {
    /* ignore */
  }
}

type GeneratedItem = {
  tempId: string
  text: string
  filter: VisitFilter | 'General'
}

const FILTER_TEMPLATES: Partial<Record<VisitFilter, string[]>> = {
  'Surgery or procedure': [
    'What do I need to stop or change before a procedure (medications, food, supplements)?',
    'What activity limits apply after my procedure, and for how long?',
    'What symptoms should prompt me to call you or seek emergency care?',
    'Who will coordinate updates with my other doctors?',
  ],
  'New diagnosis': [
    'Can you explain my diagnosis in plain language and what it means day to day?',
    'What caused this condition, and could it affect my family?',
    'What are the treatment options and the goals of each?',
    'What should I read or avoid reading online about this?',
  ],
  'Routine follow-up': [
    'Are my symptoms stable, or should we change the plan?',
    'When is my next follow-up, and what will you check?',
    'How do I reach your team between visits if something changes?',
    'What targets should I aim for (blood pressure, weight, exercise)?',
  ],
  Medications: [
    'What is each medication for, and what are the most important side effects?',
    'Are any of my medications risky when combined?',
    'Is there a simpler or less expensive option for any of these?',
    'What should I do if I miss a dose?',
  ],
  'Test results': [
    'Can you walk through my recent test results and what they mean for my heart?',
    'Do I need repeat testing, and on what schedule?',
    'Were there any findings that need a new treatment or referral?',
    'How will we track whether treatment is working?',
  ],
  'Lifestyle & wellbeing': [
    'How can stress or anxiety affect my heart, and what supports do you recommend?',
    'What diet changes matter most for my condition?',
    'What type and amount of exercise is safe for me?',
    'Is a cardiac rehab or counseling referral appropriate?',
  ],
  'Symptoms & concerns': [
    'Could my symptoms be heart-related, and what should I watch for?',
    'When should I call your office vs. go to the ER for these symptoms?',
    'Are there triggers I should avoid or track day to day?',
    'What tests would help clarify what I am feeling?',
  ],
  'Family history & genetics': [
    'Given my family history, what is my risk and how often should I be checked?',
    'Would genetic testing or screening for relatives be useful?',
    'What symptoms should family members report to a doctor?',
    'Does my family history change my treatment or monitoring plan?',
  ],
  'Prevention & heart health': [
    'What can I do to lower my risk of a heart event in the next few years?',
    'How do blood pressure, cholesterol, and weight goals apply to me?',
    'Are vaccines or other preventive steps especially important for my heart?',
    'What follow-up schedule makes sense if I stay stable?',
  ],
  'Care coordination & referrals': [
    'Do I need referrals to other specialists, and who will coordinate my care?',
    'How do I get records or test results to you from other hospitals?',
    'What should my primary care doctor know or monitor between visits?',
    'Who do I contact after-hours if something changes?',
  ],
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
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
  }

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

  if (filters.size === 0 && visitContext.trim().length < 8) {
    add('What is the most important thing I should understand about my heart health at this visit?', 'General')
    add('What changes to my medications or lifestyle do you recommend?', 'General')
  }

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
        setError((prev) => prev ?? 'Sign in to save questions for your account.')
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
      setError('Sign in to save questions for your account.')
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
      setError('Sign in to save questions for your account.')
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
      <div
        className="flex min-h-[40vh] items-center justify-center py-24"
        style={{ background: ALMOST_WHITE, fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        <p className="text-sm" style={{ color: MUTED_GREEN }}>
          Loading…
        </p>
      </div>
    )
  }

  return (
    <div className="-mx-2 w-full sm:mx-0" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: NAVY }}>
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
        <p className="max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: MUTED_GREEN }}>
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
            style={{ borderColor: LIGHT_BLUE, boxShadow: '0 2px 12px rgba(25, 43, 63, 0.06)' }}
          />

          <button
            type="button"
            disabled={generating}
            onClick={runGenerate}
            className="w-full rounded-xl px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-60 sm:w-auto sm:min-w-[200px]"
            style={{ background: DARK_GREEN }}
          >
            {generating ? 'Generating…' : 'Generate Questions'}
          </button>

          <button
            type="button"
            onClick={() => setShowCustomForm((open) => !open)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 bg-white/90 py-3 text-sm font-semibold shadow-sm transition-colors hover:bg-white sm:justify-start sm:px-4"
            style={{ borderColor: DARK_GREEN, color: DARK_GREEN }}
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
                style={{ borderColor: DARK_GREEN }}
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
                  style={{ borderColor: LIGHT_BLUE }}
                />
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED_GREEN }}>
                  Tags (optional)
                </p>
                <p className="mb-3 text-xs leading-snug" style={{ color: MUTED_GREEN }}>
                  Categories from the question library — same labels as on saved questions.
                </p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {bankCategoryTags.length === 0 ? (
                    <p className="text-xs italic" style={{ color: MUTED_GREEN }}>
                      No categories are available in the question library yet.
                    </p>
                  ) : (
                    bankCategoryTags.map((tag) => {
                      const on = customQuestionTags.has(tag)
                      return (
                        <button
                          key={`custom-tag-${tag}`}
                          type="button"
                          onClick={() => toggleCustomQuestionTag(tag)}
                          className={`rounded-full border-2 px-3 py-1.5 text-left text-xs font-medium transition-colors sm:text-sm ${
                            on
                              ? 'border-transparent text-white'
                              : 'border-[rgba(25,43,63,0.15)] bg-white/90 text-[#192b3f] hover:border-[rgba(87,117,104,0.4)]'
                          }`}
                          style={on ? { background: DARK_GREEN, borderColor: DARK_GREEN } : undefined}
                        >
                          {tag}
                        </button>
                      )
                    })
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={adding || !customLine.trim()}
                    onClick={saveCustomQuestion}
                    className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: DARK_GREEN }}
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
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED_GREEN }}>
              My visit context:
            </p>
            <div className="flex flex-wrap gap-2">
              {VISIT_CONTEXT_FILTERS.map((f) => {
                const on = selectedFilters.has(f)
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFilter(f)}
                    className={`rounded-full border-2 px-3 py-1.5 text-left text-xs font-medium transition-colors sm:text-sm ${
                      on
                        ? 'border-transparent text-white'
                        : 'border-[rgba(25,43,63,0.15)] bg-white/90 text-[#192b3f] hover:border-[rgba(87,117,104,0.4)]'
                    }`}
                    style={on ? { background: DARK_GREEN, borderColor: DARK_GREEN } : undefined}
                  >
                    {f}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mx-3 mt-4 rounded-xl border bg-white px-4 py-3 text-sm sm:mx-4"
          style={{ borderColor: 'rgba(25, 43, 63, 0.15)', color: NAVY }}
        >
          {error}
        </div>
      )}

      {/* Saved */}
      <div className="px-3 py-8 sm:px-4">
        <div className="mb-4 flex items-center gap-2">
          <Bookmark className="h-5 w-5 shrink-0" style={{ color: DARK_GREEN }} />
          <h2 className="text-lg font-semibold text-[#192b3f]">Saved questions ({saved.length})</h2>
        </div>

        {saved.length === 0 ? (
          <div
            className="rounded-xl border border-dashed bg-white/70 py-12 text-center"
            style={{ borderColor: LIGHT_BLUE }}
          >
            <p className="text-sm" style={{ color: MUTED_GREEN }}>
              No saved questions yet. Generate suggestions or add your own below.
            </p>
          </div>
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
                          style={{ color: MUTED_GREEN }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug text-[#192b3f] sm:text-base">{label}</p>
                          <span
                            className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{ background: 'rgba(198, 217, 229, 0.45)', color: NAVY }}
                          >
                            {badge.label}
                          </span>
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
                              placeholder="Doctor&apos;s answer, follow-up thoughts…"
                              rows={3}
                              className="w-full resize-y rounded-lg border px-3 py-2 text-sm text-[#192b3f] outline-none"
                              style={{ borderColor: LIGHT_BLUE }}
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
            style={{ borderColor: 'rgba(25, 43, 63, 0.08)', background: ALMOST_WHITE }}
          >
            <h2 className="mb-1 text-lg font-semibold text-[#192b3f]">Suggested for your visit</h2>
            <p className="mb-5 max-w-2xl text-sm leading-relaxed" style={{ color: MUTED_GREEN }}>
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
                    <span
                      className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: 'rgba(198, 217, 229, 0.5)', color: NAVY }}
                    >
                      {g.filter}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveGeneratedLine(g.text, g.filter)}
                    className="shrink-0 rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors"
                    style={{ borderColor: DARK_GREEN, color: DARK_GREEN }}
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
