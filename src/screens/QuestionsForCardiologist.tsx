import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, Search, Bookmark, Plus, X, BookOpen } from 'lucide-react'
import { supabase, ensureAuthUserId, CardiologistQuestion, SavedQuestion } from '../lib/supabase'

const NAVY = '#192b3f'
const LIGHT_BLUE = '#c6d9e5'
const ALMOST_WHITE = '#f5f9f9'
const DARK_GREEN = '#577568'
const MUTED_GREEN = '#acb7a8'

function getSavedLabel(row: SavedQuestion, bank: CardiologistQuestion[]): string {
  if (row.custom_text?.trim()) return row.custom_text.trim()
  const m = bank.find((q) => String(q.id) === String(row.question_id))
  return m?.question_text ?? 'Saved question'
}

function getSavedCategory(row: SavedQuestion, bank: CardiologistQuestion[]): string {
  if (!row.question_id) return 'Custom'
  const m = bank.find((q) => String(q.id) === String(row.question_id))
  return m?.category?.trim() || 'General'
}

export default function QuestionsForCardiologist() {
  const [questions, setQuestions] = useState<CardiologistQuestion[]>([])
  const [saved, setSaved] = useState<SavedQuestion[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [authBootstrapped, setAuthBootstrapped] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customText, setCustomText] = useState('')
  const [adding, setAdding] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [expandedSavedId, setExpandedSavedId] = useState<string | null>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)

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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [authBootstrapped])

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const el = searchWrapRef.current
      if (!el || !isSearchFocused) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setIsSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isSearchFocused])

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

  const dropdownSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const pool = !q
      ? questions
      : questions.filter((row) => (row.question_text ?? '').toLowerCase().includes(q))
    return pool.slice(0, 20)
  }, [questions, searchQuery])

  const filteredSaved = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return saved
    return saved.filter((row) => getSavedLabel(row, questions).toLowerCase().includes(q))
  }, [saved, searchQuery, questions])

  /** Full bank below saved: same search filter, grouped by category */
  const groupedBrowseQuestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = !q
      ? questions
      : questions.filter(
          (row) =>
            (row.question_text ?? '').toLowerCase().includes(q) ||
            (row.category ?? '').toLowerCase().includes(q),
        )
    const byCat = new Map<string, CardiologistQuestion[]>()
    for (const row of list) {
      const cat = row.category?.trim() || 'General'
      if (!byCat.has(cat)) byCat.set(cat, [])
      byCat.get(cat)!.push(row)
    }
    return [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [questions, searchQuery])

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
      const { data, error: upErr } = await supabase.from('saved_questions').upsert(row).select().single()
      if (upErr) return

      setSavedIds((prev) => new Set([...prev, idStr]))
      if (data) setSaved((prev) => [...prev, data as SavedQuestion])
    }
    setIsSearchFocused(false)
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
    setShowCustomInput(false)
    setIsSearchFocused(false)
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
    if (expandedSavedId === row.id) setExpandedSavedId(null)
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-24"
        style={{ background: ALMOST_WHITE, fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        <p className="text-sm" style={{ color: MUTED_GREEN }}>
          Loading questions…
        </p>
      </div>
    )
  }

  return (
    <div className="w-full -mx-2 sm:-mx-0" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: NAVY }}>
      {/* Page header */}
      <div className="bg-white border-b px-1 sm:px-2 py-6 sm:py-8 mb-0 rounded-t-xl sm:rounded-none" style={{ borderColor: 'rgba(25, 43, 63, 0.1)' }}>
        <h1
          className="text-3xl sm:text-4xl md:text-5xl mb-2 tracking-wide text-[#192b3f]"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}
        >
          Questions for Your Cardiologist
        </h1>
        <p className="text-sm sm:text-base max-w-xl leading-relaxed" style={{ color: MUTED_GREEN }}>
          Save questions for later to keep track of what you&apos;d like to discuss at your visit.
        </p>
      </div>

      {/* Search */}
      <div
        className="px-1 sm:px-2 py-6 border-b bg-gradient-to-r from-[rgba(198,217,229,0.45)] to-[rgba(245,249,249,0.9)]"
        style={{ borderColor: 'rgba(25, 43, 63, 0.08)' }}
      >
        <div className="max-w-3xl space-y-4">
          <div ref={searchWrapRef} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none z-[1]" style={{ color: MUTED_GREEN }} />
          <input
            type="text"
            placeholder="Search or browse questions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border-2 bg-white/90 backdrop-blur-sm outline-none transition-shadow text-[#192b3f] text-sm sm:text-base"
            style={{
              borderColor: LIGHT_BLUE,
              boxShadow: '0 2px 12px rgba(25, 43, 63, 0.06)',
            }}
          />

          <AnimatePresence>
            {isSearchFocused && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border z-20 max-h-[min(24rem,70vh)] overflow-hidden flex flex-col"
                style={{ borderColor: 'rgba(25, 43, 63, 0.12)' }}
              >
                <div className="p-4 overflow-y-auto flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[#192b3f]">Suggested questions</h3>
                    <button
                      type="button"
                      onClick={() => setIsSearchFocused(false)}
                      className="p-1 rounded-lg hover:bg-[#f5f9f9] text-[#acb7a8] hover:text-[#192b3f] transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomInput(true)
                      setIsSearchFocused(false)
                    }}
                    className="w-full text-left p-3 mb-3 rounded-xl flex items-center gap-2 transition-colors hover:bg-[rgba(87,117,104,0.12)] border-2"
                    style={{ borderColor: 'rgba(87, 117, 104, 0.35)' }}
                  >
                    <Plus className="w-4 h-4 shrink-0" style={{ color: DARK_GREEN }} />
                    <span className="text-sm font-semibold" style={{ color: DARK_GREEN }}>
                      Add your own question
                    </span>
                  </button>

                  {questions.length === 0 && (
                    <p className="text-sm text-center py-6" style={{ color: MUTED_GREEN }}>
                      No question bank loaded yet.
                    </p>
                  )}

                  <div className="space-y-1">
                    {dropdownSuggestions.map((q) => {
                      const already = savedIds.has(String(q.id))
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => toggleQuestion(q)}
                          className="w-full text-left p-3 rounded-xl transition-colors hover:bg-[rgba(198,217,229,0.25)] border border-transparent hover:border-[rgba(198,217,229,0.8)]"
                        >
                          <p className="text-sm text-[#192b3f] leading-snug pr-2">{q.question_text}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span
                              className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                              style={{ background: 'rgba(172, 183, 168, 0.35)', color: DARK_GREEN }}
                            >
                              {q.category?.trim() || 'General'}
                            </span>
                            {already && (
                              <span className="text-xs font-medium" style={{ color: DARK_GREEN }}>
                                Saved
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          {/* Add your own — below search */}
          <AnimatePresence mode="popLayout" initial={false}>
            {showCustomInput ? (
              <motion.div
                key="custom-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white rounded-xl p-4 border-2 shadow-sm" style={{ borderColor: DARK_GREEN }}>
                  <label className="text-sm font-semibold text-[#192b3f] mb-2 block">Your question</label>
                  <input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Type your question here…"
                    className="w-full px-4 py-2.5 rounded-lg border mb-3 text-[#192b3f] outline-none focus:ring-2"
                    style={{ borderColor: LIGHT_BLUE }}
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => customText.trim() && addCustomQuestion()}
                      disabled={adding || !customText.trim()}
                      className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                      style={{ background: DARK_GREEN }}
                    >
                      Save question
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomInput(false)
                        setCustomText('')
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-[#e8ecec] text-[#192b3f] hover:bg-[#dce2e2] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="custom-cta"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 bg-white/95 font-semibold text-sm sm:text-base transition-colors hover:bg-white shadow-sm"
                  style={{ borderColor: DARK_GREEN, color: DARK_GREEN }}
                >
                  <Plus className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem] shrink-0" strokeWidth={2.5} />
                  Add your own question
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mx-1 sm:mx-2 mt-4 rounded-xl px-4 py-3 text-sm border bg-white"
          style={{ borderColor: 'rgba(25, 43, 63, 0.15)', color: NAVY }}
        >
          {error}
        </div>
      )}

      {/* Saved */}
      <div className="px-1 sm:px-2 py-8">
        <div className="flex items-center gap-2 mb-4">
          <Bookmark className="w-5 h-5 shrink-0" style={{ color: DARK_GREEN }} />
          <h2 className="text-lg font-semibold text-[#192b3f]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            Saved questions ({filteredSaved.length})
          </h2>
        </div>

        {saved.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed bg-white/60" style={{ borderColor: LIGHT_BLUE }}>
            <p className="text-sm" style={{ color: MUTED_GREEN }}>
              No saved questions yet. Use &ldquo;Add your own question&rdquo; below search or pick from suggestions and browse.
            </p>
          </div>
        ) : filteredSaved.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: MUTED_GREEN }}>
            No saved questions match your search.
          </p>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredSaved.map((item, index) => {
                const label = getSavedLabel(item, questions)
                const category = getSavedCategory(item, questions)
                const isCustom = !item.question_id
                const open = expandedSavedId === item.id

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="bg-white rounded-xl border overflow-hidden"
                    style={{ borderColor: 'rgba(25, 43, 63, 0.1)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedSavedId(open ? null : item.id)}
                      className="w-full px-4 py-4 flex items-start justify-between gap-3 text-left hover:bg-[#f5f9f9]/80 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <ChevronDown
                          className={`w-5 h-5 shrink-0 mt-0.5 transition-transform duration-200 ${
                            open ? 'rotate-180' : ''
                          }`}
                          style={{ color: MUTED_GREEN }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[#192b3f] text-sm sm:text-base font-medium leading-snug">{label}</p>
                          <span
                            className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
                              isCustom ? 'border' : ''
                            }`}
                            style={
                              isCustom
                                ? {
                                    background: ALMOST_WHITE,
                                    color: DARK_GREEN,
                                    borderColor: LIGHT_BLUE,
                                  }
                                : { background: 'rgba(172, 183, 168, 0.35)', color: DARK_GREEN }
                            }
                          >
                            {isCustom ? 'Custom' : category}
                          </span>
                        </div>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="border-t overflow-hidden"
                          style={{ borderColor: 'rgba(25, 43, 63, 0.08)' }}
                        >
                          <div className="px-4 py-4 bg-[#f5f9f9]/90 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <p className="text-sm leading-relaxed flex-1" style={{ color: MUTED_GREEN }}>
                              Add your own notes or reminders for this question before your appointment.
                            </p>
                            <button
                              type="button"
                              onClick={() => removeQuestion(item)}
                              className="text-sm font-semibold shrink-0 px-3 py-1.5 rounded-lg border transition-colors hover:bg-white"
                              style={{ borderColor: LIGHT_BLUE, color: DARK_GREEN }}
                            >
                              Remove
                            </button>
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

      {/* Browse question bank */}
      <div
        className="px-1 sm:px-2 py-8 border-t"
        style={{ borderColor: 'rgba(25, 43, 63, 0.08)', background: 'rgba(245, 249, 249, 0.5)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 shrink-0" style={{ color: DARK_GREEN }} />
          <h2 className="text-lg font-semibold text-[#192b3f]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            Browse questions
          </h2>
        </div>
        <p className="text-sm mb-6 max-w-2xl leading-relaxed" style={{ color: MUTED_GREEN }}>
          Explore the full list from the question bank. Tap a row to save or remove it from your list. Use the search
          above to narrow what you see here and in saved questions.
        </p>

        {questions.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-dashed bg-white/70" style={{ borderColor: LIGHT_BLUE }}>
            <p className="text-sm" style={{ color: MUTED_GREEN }}>
              No questions in the bank yet.
            </p>
          </div>
        ) : groupedBrowseQuestions.length === 0 ? (
          <p className="text-sm text-center py-8 rounded-xl bg-white/60 border" style={{ borderColor: LIGHT_BLUE, color: MUTED_GREEN }}>
            No questions match your search. Try a different term or clear the search box.
          </p>
        ) : (
          <div className="space-y-8">
            {groupedBrowseQuestions.map(([category, items], catIndex) => (
              <motion.section
                key={category}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: catIndex * 0.05, duration: 0.25 }}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: MUTED_GREEN }}>
                  {category}
                </h3>
                <ul className="space-y-2 list-none p-0 m-0">
                  {items.map((q, i) => {
                    const already = savedIds.has(String(q.id))
                    return (
                      <motion.li
                        key={q.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(catIndex * 0.04 + i * 0.02, 0.35) }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleQuestion(q)}
                          className="w-full text-left p-3.5 sm:p-4 rounded-xl border bg-white transition-colors hover:bg-[rgba(198,217,229,0.2)]"
                          style={{ borderColor: 'rgba(25, 43, 63, 0.1)' }}
                        >
                          <p className="text-sm sm:text-[0.9375rem] text-[#192b3f] leading-snug pr-2">{q.question_text}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span
                              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                              style={{
                                background: already ? 'rgba(87, 117, 104, 0.15)' : 'rgba(172, 183, 168, 0.25)',
                                color: DARK_GREEN,
                              }}
                            >
                              {already ? 'Saved — tap to remove' : 'Tap to save'}
                            </span>
                          </div>
                        </button>
                      </motion.li>
                    )
                  })}
                </ul>
              </motion.section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
