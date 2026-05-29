import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Bookmark, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { CareTeamIntakeForm } from '../components/careTeam/CareTeamIntakeForm'
import { fetchCareTeamCorpusList } from '../lib/careTeamCorpusApi'
import {
  fetchLatestGeneratedQuestionsFromApi,
  generateCareTeamQuestionsFromApi,
} from '../lib/careTeamQuestionApi'
import { EMPTY_CARE_TEAM_INTAKE, isCareTeamIntakeComplete, type CareTeamIntakeAnswers } from '../lib/careTeamQuestionIntake'
import {
  supabase,
  ensureAuthUserId,
  normalizeSavedQuestion,
  normalizeSavedQuestionSource,
  SavedQuestion,
  type SavedQuestionSource,
} from '../lib/supabase'

function generateMockQuestions(intake: CareTeamIntakeAnswers): GeneratedItem[] {
  const provider = intake.providerTypes[0] ?? 'Cardiologist'
  const visit = intake.visitTypes[0] ?? 'Cardiology Visit'
  const target = intake.targetPerson ?? 'Caregiver'
  const level = intake.knowledgeLevel ?? 'Beginner'

  const isChild = target === 'Child'
  const isBeginner = level === 'Beginner'
  const isSurgery = visit.includes('Surgery') || provider === 'Surgeon'
  const isEmergency = visit === 'Emergency Concern'
  const isMentalHealth = provider === 'Mental Health Provider' || visit === 'Mental Health Support'
  const them = isChild ? "my child's" : 'my'
  const they = isChild ? 'my child' : 'me'
  const we = isChild ? 'we' : 'I'

  const pool: { text: string; category: string }[] = [
    {
      text: `What is the current status of ${them} condition and has anything changed since the last visit?`,
      category: 'Diagnosis & Condition',
    },
    isBeginner
      ? { text: `Can you explain ${them} diagnosis in plain language, without medical jargon?`, category: 'Diagnosis & Condition' }
      : { text: `Are there any new research findings or treatment options ${we} should be aware of?`, category: 'Diagnosis & Condition' },
    isSurgery
      ? { text: `What are the risks and benefits of this surgery, and what happens if we delay?`, category: 'Surgery & Procedures' }
      : { text: `What tests or imaging are planned for today, and when will we get results?`, category: 'Tests & Monitoring' },
    isSurgery
      ? { text: `What does recovery look like after the procedure — how long, and what restrictions apply?`, category: 'Surgery & Procedures' }
      : { text: `How often should ${we} be scheduling follow-up visits going forward?`, category: 'Follow-up Care' },
    {
      text: `What warning signs or symptoms should prompt ${we} to call or go to the emergency room right away?`,
      category: 'Safety & Emergency',
    },
    {
      text: `Are there any activity restrictions — sports, school, travel — for ${they}?`,
      category: 'Daily Life & Activity',
    },
    {
      text: `What medications is ${they} currently on, and are there any side effects ${we} should watch for?`,
      category: 'Medications',
    },
    isMentalHealth
      ? { text: `What mental health resources or support groups do you recommend for ${isChild ? 'our family' : 'me'}?`, category: 'Mental Health & Support' }
      : { text: `How does this condition affect long-term heart function, and what does the outlook look like?`, category: 'Long-term Outlook' },
    {
      text: `Are there lifestyle changes — diet, exercise, sleep — that could improve ${them} heart health?`,
      category: 'Daily Life & Activity',
    },
    isEmergency
      ? { text: `When is this symptom considered an emergency, and what is the protocol for getting immediate care?`, category: 'Safety & Emergency' }
      : { text: `What should ${we} do to prepare for the next appointment and who should ${we} contact with questions?`, category: 'Follow-up Care' },
  ]

  return pool.slice(0, 10).map((q, i) => ({
    id: `mock-${i + 1}`,
    position: i + 1,
    text: q.text,
    category: q.category,
  }))
}

const NAVY = '#192b3f'
const LIGHT_BLUE = '#c6d9e5'
const ALMOST_WHITE = '#f5f9f9'
const DARK_GREEN = '#577568'
const MUTED_GREEN = '#acb7a8'

const META_STORAGE_PREFIX = 'cardea-saved-q-meta'
const LOCAL_SAVED_PREFIX = 'cardea-saved-questions'

function localSavedKey(userId: string | null): string {
  return userId ? `${LOCAL_SAVED_PREFIX}:${userId}` : `${LOCAL_SAVED_PREFIX}:anon`
}

function loadLocalSaved(userId: string | null): SavedQuestion[] {
  try {
    const raw = localStorage.getItem(localSavedKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
      .map((row) => normalizeSavedQuestion(row as SavedQuestion))
  } catch {
    return []
  }
}

function persistLocalSaved(userId: string | null, rows: SavedQuestion[]) {
  try {
    localStorage.setItem(localSavedKey(userId), JSON.stringify(rows))
  } catch { /* ignore */ }
}

function makeLocalSavedQuestion(text: string, userId: string | null, source: SavedQuestionSource): SavedQuestion {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user_id: userId ?? 'anon',
    question_id: null,
    custom_text: text,
    source,
  }
}

type SavedQuestionMeta = {
  source: SavedQuestionSource
  contextTags: string[]
  notes: string
  /** Links a saved row back to `care_team_generated_questions.id` for + Save button state. */
  generatedSourceId?: string
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
    const rawSource = typeof e.source === 'string' ? e.source.trim().toLowerCase() : ''
    if (
      rawSource !== 'generated' &&
      rawSource !== 'custom' &&
      rawSource !== 'preset' &&
      rawSource !== 'bank' &&
      rawSource !== 'corpus'
    ) continue
    const notes = typeof e.notes === 'string' ? e.notes : ''
    const contextTags = Array.isArray(e.contextTags)
      ? e.contextTags.filter((t): t is string => typeof t === 'string')
      : []
    const generatedSourceId =
      typeof e.generatedSourceId === 'string' && e.generatedSourceId.trim()
        ? e.generatedSourceId.trim()
        : undefined
    out[id] = {
      source: normalizeSavedQuestionSource(rawSource),
      contextTags,
      notes,
      ...(generatedSourceId ? { generatedSourceId } : {}),
    }
  }
  return out
}

function buildSavedGeneratedIds(
  generated: GeneratedItem[],
  saved: SavedQuestion[],
  meta: Record<string, SavedQuestionMeta>,
): Set<string> {
  const ids = new Set<string>()
  for (const g of generated) {
    for (const s of saved) {
      const m = meta[s.id]
      if (!m) continue
      if (m.generatedSourceId === g.id) {
        ids.add(g.id)
        break
      }
      if (m.source === 'generated' && s.custom_text?.trim() === g.text.trim()) {
        ids.add(g.id)
        break
      }
    }
  }
  return ids
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

export default function QuestionsForCareTeam() {
  const [, setSearchParams] = useSearchParams()
  const [saved, setSaved] = useState<SavedQuestion[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [authBootstrapped, setAuthBootstrapped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [intake, setIntake] = useState(EMPTY_CARE_TEAM_INTAKE)
  const [generated, setGenerated] = useState<GeneratedItem[]>([])
  const [generating, setGenerating] = useState(false)

  const [activeTab, setActiveTab] = useState<'suggested' | 'saved'>('suggested')
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
  const [savingGeneratedId, setSavingGeneratedId] = useState<string | null>(null)
  const [savedGeneratedIds, setSavedGeneratedIds] = useState<Set<string>>(() => new Set())
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
      const [corpusResult, generatedBatch] = await Promise.all([
        fetchCareTeamCorpusList().catch(() => ({ questions: [], categories: [] as string[] })),
        uid
          ? fetchLatestGeneratedQuestionsFromApi(uid).catch(() => ({
              generationId: null,
              expiresAt: null,
              questions: [],
            }))
          : Promise.resolve({ generationId: null, expiresAt: null, questions: [] }),
      ])

      setCorpusCategories(corpusResult.categories)
      setGenerated(mapApiQuestionsToGenerated(generatedBatch.questions))

      if (uid) {
        const { data: savedRows, error: sError } = await supabase
          .from('saved_questions')
          .select('*')
          .eq('user_id', uid)
        if (sError) {
          setSaved(loadLocalSaved(uid))
        } else {
          const existingMeta = loadAllMeta(uid)
          const rows = ((savedRows as SavedQuestion[]) ?? []).map((row) =>
            normalizeSavedQuestion(row, existingMeta[row.id]?.source ?? null),
          )
          setSaved(rows)
          // Seed savedMeta from the normalized DB source so color coding works
          // across devices and migrates older bank/corpus values to preset.
          setSavedMeta((prev) => {
            const merged = { ...existingMeta, ...prev }
            for (const row of rows) {
              if (!merged[row.id]) {
                merged[row.id] = {
                  source: row.source,
                  contextTags: [],
                  notes: '',
                }
              }
            }
            persistAllMeta(uid, merged)
            return merged
          })
        }
      } else {
        setSaved(loadLocalSaved(null))
      }
    } catch (e) {
      setSaved(loadLocalSaved(uid))
      setError(e instanceof Error ? e.message : 'Could not load saved questions.')
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

  const runGenerate = async () => {
    if (!isCareTeamIntakeComplete(intake)) {
      setError('Please answer all four questions above before generating.')
      return
    }
    setError(null)
    setGenerating(true)
    try {
      let items: GeneratedItem[]
      if (userId) {
        try {
          const batch = await generateCareTeamQuestionsFromApi(intake, userId)
          items = mapApiQuestionsToGenerated(batch.questions)
        } catch {
          items = generateMockQuestions(intake)
        }
      } else {
        items = generateMockQuestions(intake)
      }
      setGenerated(items)
      if (items.length > 0) {
        setActiveTab('suggested')
        window.setTimeout(() => {
          document.getElementById('questions-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 50)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate questions. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function saveGeneratedItem(item: GeneratedItem) {
    const text = item.text.trim()
    if (!text || savingGeneratedId) return

    setSavingGeneratedId(item.id)
    setError(null)

    let s: SavedQuestion | null = null

    if (userId) {
      const row = { user_id: userId, question_id: null, custom_text: text, source: 'generated' as const }
      const { data, error: insErr } = await supabase.from('saved_questions').insert(row).select().single()
      if (!insErr && data) {
        s = normalizeSavedQuestion(data as SavedQuestion, 'generated')
      }
    }

    if (!s) {
      s = makeLocalSavedQuestion(text, userId, 'generated')
      setSaved((prev) => {
        const next = [...prev, s!]
        persistLocalSaved(userId, next)
        return next
      })
    } else {
      setSaved((prev) => [...prev, s!])
    }

    setSavingGeneratedId(null)
    setSavedMeta((prev) => {
      const next = {
        ...prev,
        [s!.id]: {
          source: 'generated' as const,
          contextTags: [item.category],
          notes: '',
          generatedSourceId: item.id,
        },
      }
      persistAllMeta(userId, next)
      return next
    })
  }

  async function saveCustomQuestion() {
    if (!customLine.trim()) return
    setAdding(true)

    let s: SavedQuestion | null = null

    if (userId) {
      const row = { user_id: userId, question_id: null, custom_text: customLine.trim(), source: 'custom' as const }
      const { data, error: insErr } = await supabase.from('saved_questions').insert(row).select().single()
      if (!insErr && data) {
        s = normalizeSavedQuestion(data as SavedQuestion, 'custom')
      }
    }

    if (!s) {
      s = makeLocalSavedQuestion(customLine.trim(), userId, 'custom')
      setSaved((prev) => {
        const next = [...prev, s!]
        persistLocalSaved(userId, next)
        return next
      })
    } else {
      setSaved((prev) => [...prev, s!])
    }

    setSavedMeta((prev) => {
      const next = {
        ...prev,
        [s!.id]: {
          source: 'custom' as const,
          contextTags: [...customQuestionTags],
          notes: '',
        },
      }
      persistAllMeta(userId, next)
      return next
    })

    setCustomLine('')
    setCustomQuestionTags(new Set())
    setShowCustomForm(false)
    setAdding(false)
  }

  async function removeQuestion(row: SavedQuestion) {
    const linkedGeneratedId = savedMeta[row.id]?.generatedSourceId
    if (userId && !row.id.startsWith('local-')) {
      await supabase.from('saved_questions').delete().eq('id', row.id)
    }

    setSaved((prev) => {
      const next = prev.filter((r) => r.id !== row.id)
      persistLocalSaved(userId, next)
      return next
    })
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
          QUESTIONS FOR YOUR HEALTH CARE TEAM
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

          <div className="grid grid-cols-2 gap-3 border-t pt-6" style={{ borderColor: 'rgba(25, 43, 63, 0.1)' }}>
            <button
              type="button"
              onClick={() => setSearchParams({ view: 'care-team-standard' })}
              className="flex w-full items-center justify-center rounded-xl border-2 bg-white px-3 py-4 text-sm font-semibold shadow-sm transition-colors hover:bg-white/95 sm:text-base"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              View standard questions
            </button>

            <button
              type="button"
              onClick={() => setShowCustomForm((open) => !open)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 bg-white px-3 py-4 text-sm font-semibold shadow-sm transition-colors hover:bg-white/95 sm:text-base"
              style={{ borderColor: DARK_GREEN, color: DARK_GREEN }}
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              {showCustomForm ? 'Close' : 'Add your own'}
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

      {/* Tab bar + panel */}
      <div id="questions-panel" className="border-t pt-6" style={{ borderColor: 'rgba(25, 43, 63, 0.08)' }}>
        {/* Tabs — pill style */}
        <div className="px-3 sm:px-4">
          <div
            className="mx-auto flex max-w-3xl gap-2 rounded-xl p-1.5"
            style={{ background: 'rgba(25,43,63,0.06)' }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('suggested')}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all"
              style={
                activeTab === 'suggested'
                  ? { background: DARK_GREEN, color: '#ffffff', boxShadow: '0 1px 6px rgba(87,117,104,0.35)' }
                  : { color: MUTED_GREEN }
              }
            >
              Suggested
              {generated.length > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={
                    activeTab === 'suggested'
                      ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                      : { background: 'rgba(198,217,229,0.7)', color: NAVY }
                  }
                >
                  {generated.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all"
              style={
                activeTab === 'saved'
                  ? { background: DARK_GREEN, color: '#ffffff', boxShadow: '0 1px 6px rgba(87,117,104,0.35)' }
                  : { color: MUTED_GREEN }
              }
            >
              <Bookmark className="h-4 w-4 shrink-0" />
              Saved
              {saved.length > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={
                    activeTab === 'saved'
                      ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                      : { background: 'rgba(172,183,168,0.55)', color: NAVY }
                  }
                >
                  {saved.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Panel content */}
        <div className="px-3 py-6 sm:px-4" style={{ background: ALMOST_WHITE, minHeight: '320px' }}>
          {activeTab === 'suggested' ? (
            generated.length === 0 ? (
              <div
                className="rounded-xl border border-dashed bg-white/70 py-16 text-center"
                style={{ borderColor: LIGHT_BLUE }}
              >
                <p className="text-sm" style={{ color: MUTED_GREEN }}>
                  Fill in the visit details above and tap <strong>Generate Questions</strong> to see suggestions.
                </p>
              </div>
            ) : (
              <ul className="mx-auto max-w-3xl space-y-3">
                {generated.map((g) => {
                  const alreadySaved = savedGeneratedIds.has(g.id)
                  const isSaving = savingGeneratedId === g.id
                  return (
                    <li
                      key={`${g.id}-${g.position}`}
                      className="flex items-start gap-3 rounded-xl border p-4"
                      style={{ borderColor: '#a8c8dc', background: 'rgba(198,217,229,0.22)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-[#192b3f]">{g.text}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{ background: '#c6d9e5', color: NAVY }}
                          >
                            {g.category}
                          </span>
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(198,217,229,0.5)', color: '#2a5070' }}>AI suggested</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={alreadySaved || isSaving || Boolean(savingGeneratedId)}
                        onClick={(e) => { e.stopPropagation(); void saveGeneratedItem(g) }}
                        className="shrink-0 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
                        style={{ borderColor: DARK_GREEN, color: DARK_GREEN }}
                      >
                        {alreadySaved ? 'Saved' : isSaving ? 'Saving…' : '+ Save'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
          ) : (
            saved.length === 0 ? (
              <div
                className="rounded-xl border border-dashed bg-white/70 py-16 text-center"
                style={{ borderColor: LIGHT_BLUE }}
              >
                <p className="text-sm" style={{ color: MUTED_GREEN }}>
                  No saved questions yet. Generate suggestions or add your own above.
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-3">
                <AnimatePresence>
                  {saved.map((item, index) => {
                    const label = getSavedLabel(item)
                    const badge = savedBadge(item)
                    const open = expandedSavedId === item.id
                    const notes = savedMeta[item.id]?.notes ?? ''
                    const source = savedMeta[item.id]?.source ?? item.source

                    const cardColors =
                      source === 'generated'
                        ? { border: '#a8c8dc', bg: 'rgba(198,217,229,0.22)', badgeBg: '#c6d9e5', badgeText: NAVY, sourceLabel: 'Generated', sourceBg: 'rgba(198,217,229,0.5)', sourceText: '#2a5070' }
                        : source === 'custom'
                        ? { border: 'rgba(87,117,104,0.5)', bg: 'rgba(87,117,104,0.08)', badgeBg: 'rgba(87,117,104,0.18)', badgeText: DARK_GREEN, sourceLabel: 'Custom', sourceBg: 'rgba(87,117,104,0.12)', sourceText: DARK_GREEN }
                        : { border: 'rgba(25,43,63,0.18)', bg: '#f9faf8', badgeBg: 'rgba(25,43,63,0.07)', badgeText: NAVY, sourceLabel: 'Preset', sourceBg: 'rgba(25,43,63,0.05)', sourceText: MUTED_GREEN }

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="overflow-hidden rounded-xl border"
                        style={{ borderColor: cardColors.border, background: cardColors.bg }}
                      >
                        <div className="flex items-start gap-3 p-4">
                          <button
                            type="button"
                            onClick={() => setExpandedSavedId(open ? null : item.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="text-sm font-medium leading-snug text-[#192b3f]">{label}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                                style={{ background: cardColors.badgeBg, color: cardColors.badgeText }}
                              >
                                {badge.label}
                              </span>
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ background: cardColors.sourceBg, color: cardColors.sourceText }}
                              >
                                {cardColors.sourceLabel}
                              </span>
                            </div>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setExpandedSavedId(open ? null : item.id)}
                              className="rounded-lg p-1.5 transition-colors hover:bg-black/5"
                              aria-label="Add notes"
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                                style={{ color: MUTED_GREEN }}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeQuestion(item)}
                              className="rounded-lg p-1.5 transition-colors hover:bg-red-50 hover:text-red-600"
                              style={{ color: MUTED_GREEN }}
                              aria-label="Remove question"
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={2} />
                            </button>
                          </div>
                        </div>

                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t"
                              style={{ borderColor: 'rgba(25,43,63,0.08)' }}
                            >
                              <div className="bg-[#f5f9f9]/90 px-4 py-3">
                                <label className="mb-1 block text-xs font-semibold text-[#192b3f]">Notes</label>
                                <textarea
                                  value={notes}
                                  onChange={(e) => patchMeta(item.id, { notes: e.target.value })}
                                  placeholder="Doctor's answer, follow-up thoughts…"
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
            )
          )}
        </div>
      </div>
    </div>
  )
}
