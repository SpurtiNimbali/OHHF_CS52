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
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [authBootstrapped, setAuthBootstrapped] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<FilterCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customText, setCustomText] = useState('')
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
    if (!authBootstrapped) return
    setSavedMeta(loadAllMeta(userId))
  }, [authBootstrapped, userId])

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

      if (!uid && !qError) {
        setError((prev) => prev ?? 'Sign in to save questions for your account.')
      }
    } catch (e) {
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

  const toggleFilter = (f: VisitFilter) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
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
        style={{
          background: 'linear-gradient(135deg, #f43f5e 0%, #a855f7 50%, #6366f1 100%)',
          padding: '40px 24px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            left: '-50px',
            width: '200px',
            height: '200px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-30px',
            right: '10%',
            width: '150px',
            height: '150px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20%',
            width: '80px',
            height: '80px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '50%',
          }}
        />

        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            color: '#ffffff',
            margin: 0,
            textShadow: '0 2px 10px rgba(0,0,0,0.2)',
            position: 'relative',
          }}
        >
          💬 Questions for Your Cardiologist
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: MUTED_GREEN }}>
          Describe your upcoming visit and we&apos;ll suggest questions to ask — or add your own.
        </p>
      </div>

      <div
        style={{
          maxWidth: '800px',
          margin: '-30px auto 30px',
          padding: '0 20px',
          position: 'relative',
          zIndex: 10,
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
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #f3f4f6',
            }}
          >
            <p
              style={{
                fontSize: '0.85rem',
                color: '#888',
                marginBottom: '12px',
                fontWeight: 600,
              }}
            >
              Personalize from your profile (PLACEHOLDER RULES CURRENTLY):
            </p>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                marginBottom: '10px',
                fontSize: '0.9rem',
                color: '#444',
              }}
            >
              <input
                type="checkbox"
                checked={personalizeByAge}
                onChange={(e) => setPersonalizeByAge(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#f43f5e' }}
              />
              Related to age
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: '#444',
              }}
            >
              <input
                type="checkbox"
                checked={personalizeByCondition}
                onChange={(e) => setPersonalizeByCondition(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#f43f5e' }}
              />
              Related to condition
            </label>
          </div>

          <div
            style={{
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #fce7f3',
            }}
          >
            <p
              style={{
                fontSize: '0.85rem',
                color: '#888',
                marginBottom: '10px',
                fontWeight: 600,
              }}
            >
              Add your own question
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomQuestion()}
                placeholder="Type your question..."
                style={{
                  flex: '1 1 200px',
                  border: '1px solid #fbcfe8',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={addCustomQuestion}
                disabled={adding || !customText.trim()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: adding || !customText.trim() ? '#fda4af' : '#f43f5e',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: adding || !customText.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px 40px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '3rem' }}>⏳</div>
            <p style={{ color: '#f43f5e', fontSize: '1.2rem', fontWeight: 600 }}>Loading questions...</p>
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              background: '#ffebee',
              border: '2px solid #ffcdd2',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <p style={{ color: '#c62828', fontWeight: 600, marginTop: '8px' }}>{error}</p>
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div
            style={{
              background: '#fff8e1',
              border: '2px solid #ffe082',
              borderRadius: '16px',
              padding: '40px 24px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '3rem' }}>📋</span>
            <p style={{ color: '#f57f17', fontSize: '1.2rem', fontWeight: 600, marginTop: '12px' }}>
              No questions in the database yet
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
              {selectedTag ? `No ${selectedTag} questions match` : 'No questions match your search'}
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
                    animation: `fadeInUp 0.5s ease ${index * 0.04}s both`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)'
                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(244, 63, 94, 0.18)'
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
                        border: `1px solid ${colors.border}`,
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
        )}

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
