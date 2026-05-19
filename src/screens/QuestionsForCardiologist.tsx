import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Bookmark, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { CareTeamIntakeForm } from '../components/careTeam/CareTeamIntakeForm'
import { fetchCareTeamCorpusList } from '../lib/careTeamCorpusApi'
import {
  fetchLatestGeneratedQuestionsFromApi,
  generateCareTeamQuestionsFromApi,
} from '../lib/careTeamQuestionApi'
import { EMPTY_CARE_TEAM_INTAKE, isCareTeamIntakeComplete } from '../lib/careTeamQuestionIntake'
import { supabase, ensureAuthUserId, SavedQuestion } from '../lib/supabase'

const NAVY = '#192b3f'
const LIGHT_BLUE = '#c6d9e5'
const ALMOST_WHITE = '#f5f9f9'
const DARK_GREEN = '#577568'
const MUTED_GREEN = '#acb7a8'

const META_STORAGE_PREFIX = 'cardea-saved-q-meta'

type SavedQuestionMeta = {
  source: 'generated' | 'custom' | 'bank'
  contextTags: string[]
  notes: string
  /** Links a saved row back to `care_team_generated_questions.id` for + Save button state. */
  generatedSourceId?: string
}

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
  id: string
  position: number
  text: string
  category: string
}

function mapApiQuestionsToGenerated(
  questions: { id: string; question: string; category: string; position?: number }[],
): GeneratedItem[] {
  return questions.map((q, i) => ({
    id: q.id?.trim() || `local-${i}`,
    position: typeof q.position === 'number' && q.position > 0 ? q.position : i + 1,
    text: q.question,
    category: q.category?.trim() || 'General',
  }))
}

function getSavedLabel(row: SavedQuestion): string {
  if (row.custom_text?.trim()) return row.custom_text.trim()
  return 'Saved question'
}

export default function QuestionsForCardiologist() {
  const [, setSearchParams] = useSearchParams()
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
  const [corpusCategories, setCorpusCategories] = useState<string[]>([])

  useEffect(() => {
    const valid = new Set(corpusCategories)
    setCustomQuestionTags((prev) => {
      const filtered = [...prev].filter((t) => valid.has(t))
      if (filtered.length === prev.size && filtered.every((t) => prev.has(t))) return prev
      return new Set(filtered)
    })
  }, [corpusCategories])
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
    setSavedGeneratedIds(buildSavedGeneratedIds(generated, saved, savedMeta))
  }, [generated, saved, savedMeta])

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

      if (!uid) {
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

  const toggleCustomQuestionTag = (tag: string) => {
    setCustomQuestionTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
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
    const linkedGeneratedId = savedMeta[row.id]?.generatedSourceId
    const { error: delErr } = await supabase.from('saved_questions').delete().eq('id', row.id)
    if (delErr) return

    setSaved((prev) => prev.filter((r) => r.id !== row.id))
    setSavedMeta((prev) => {
      const next = { ...prev }
      delete next[row.id]
      persistAllMeta(userId, next)
      return next
    })
    if (linkedGeneratedId) {
      setSavedGeneratedIds((prev) => {
        const next = new Set(prev)
        next.delete(linkedGeneratedId)
        return next
      })
    } else if (row.custom_text?.trim()) {
      const text = row.custom_text.trim()
      const match = generated.find((g) => g.text.trim() === text)
      if (match) {
        setSavedGeneratedIds((prev) => {
          const next = new Set(prev)
          next.delete(match.id)
          return next
        })
      }
    }
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
      return { label: 'Saved' }
    },
    [savedMeta],
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
          Tell us about your upcoming visit and we&apos;ll suggest questions for your health care team.
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
        <div className="mx-auto max-w-3xl space-y-6">
          <CareTeamIntakeForm value={intake} onChange={setIntake} />

          <button
            type="button"
            disabled={generating || !isCareTeamIntakeComplete(intake)}
            onClick={runGenerate}
            className="w-full rounded-xl px-5 py-4 text-base font-semibold text-white shadow-sm transition-opacity disabled:opacity-60"
            style={{ background: DARK_GREEN }}
          >
            {generating ? 'Generating…' : 'Generate Questions'}
          </button>

          <div className="space-y-3 border-t pt-6" style={{ borderColor: 'rgba(25, 43, 63, 0.1)' }}>
            <button
              type="button"
              onClick={() => setSearchParams({ view: 'standard-questions' })}
              className="flex w-full items-center justify-center rounded-xl border-2 bg-white px-5 py-4 text-base font-semibold shadow-sm transition-colors hover:bg-white/95"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              View standard questions
            </button>

            <button
              type="button"
              onClick={() => setShowCustomForm((open) => !open)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 bg-white px-5 py-4 text-base font-semibold shadow-sm transition-colors hover:bg-white/95"
              style={{ borderColor: DARK_GREEN, color: DARK_GREEN }}
            >
              <Plus className="h-5 w-5 shrink-0" strokeWidth={2.5} />
              {showCustomForm ? 'Close — add your own question' : 'Add your own question'}
            </button>
          </div>

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
                  Optional tags from the standard question library.
                </p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {corpusCategories.length === 0 ? (
                    <p className="text-xs italic" style={{ color: MUTED_GREEN }}>
                      No categories are available in the question library yet.
                    </p>
                  ) : (
                    corpusCategories.map((tag) => {
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

      {generated.length > 0 && (
        <section
          id="suggested-questions"
          className="relative isolate z-10 scroll-mt-4 border-t px-3 py-8 sm:px-4 sm:scroll-mt-6"
          style={{ borderColor: 'rgba(25, 43, 63, 0.08)', background: ALMOST_WHITE }}
        >
          <h2 className="mb-1 text-lg font-semibold text-[#192b3f]">Suggested for your visit</h2>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed" style={{ color: MUTED_GREEN }}>
            Based on what you shared. Tap to save any question.
          </p>
          <ul className="mx-auto max-w-3xl space-y-3">
            {generated.map((g) => {
              const alreadySaved = savedGeneratedIds.has(g.id)
              const isSaving = savingGeneratedId === g.id
              return (
                <li
                  key={`${g.id}-${g.position}`}
                  className="relative z-10 flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderColor: 'rgba(25, 43, 63, 0.1)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-[#192b3f]">{g.text}</p>
                    <span
                      className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: 'rgba(198, 217, 229, 0.5)', color: NAVY }}
                    >
                      {g.category}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={alreadySaved || isSaving || Boolean(savingGeneratedId)}
                    onClick={(e) => {
                      e.stopPropagation()
                      void saveGeneratedItem(g)
                    }}
                    className="relative z-20 shrink-0 rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{ borderColor: DARK_GREEN, color: DARK_GREEN }}
                  >
                    {alreadySaved ? 'Saved' : isSaving ? 'Saving…' : '+ Save'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
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
              No saved questions yet. Generate suggestions above or add your own.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {saved.map((item, index) => {
                const label = getSavedLabel(item)
                const badge = savedBadge(item)
                const open = expandedSavedId === item.id
                const notes = savedMeta[item.id]?.notes ?? ''

                return (
                  <motion.div
                    key={item.id}
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
    </div>
  )
}
