import { useCallback, useEffect, useMemo, useState } from 'react'
// @ts-expect-error - SearchBar is a JSX component without type declarations
import SearchBar from '../components/SearchBar'
import { supabase, ensureAuthUserId, CardiologistQuestion, SavedQuestion } from '../lib/supabase'

const FILTER_CATEGORIES = ['Diagnosis', 'Treatment', 'Lifestyle', 'Monitoring'] as const
type FilterCategory = (typeof FILTER_CATEGORIES)[number]

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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
        padding: '0',
      }}
    >
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
        <p
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '1.1rem',
            marginTop: '12px',
            position: 'relative',
          }}
        >
          Save questions to bring to your next appointment
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
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 10px 40px rgba(244, 63, 94, 0.15)',
          }}
        >
          <SearchBar value={query} onChange={setQuery} />

          <div style={{ marginTop: '16px' }}>
            <p
              style={{
                fontSize: '0.85rem',
                color: '#888',
                marginBottom: '10px',
                fontWeight: 600,
              }}
            >
              Filter by topic:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: selectedTag === null ? '2px solid #f43f5e' : '2px solid #e0e0e0',
                  background: selectedTag === null ? '#f43f5e' : '#ffffff',
                  color: selectedTag === null ? '#ffffff' : '#666',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
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
                      borderRadius: '20px',
                      border: isSelected ? `2px solid ${colors.text}` : `2px solid ${colors.border}`,
                      background: isSelected ? colors.text : colors.bg,
                      color: isSelected ? '#ffffff' : colors.text,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
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
                    {question.question_text}
                  </p>

                  <div
                    style={{
                      marginTop: '16px',
                      height: '4px',
                      background: `linear-gradient(90deg, ${colors.border}, ${colors.bg})`,
                      borderRadius: '2px',
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}

        {saved.length > 0 && (
          <section style={{ marginTop: '40px' }}>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#2c3e50',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              Your saved questions ({saved.length})
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {saved.map((row) => {
                const isCustom = !row.question_id
                const matched = questions.find((q) => String(q.id) === String(row.question_id))
                const label = row.custom_text ?? matched?.question_text ?? ''
                const catBucket = matched ? normalizeCategory(matched.category) : 'other'
                const catLabel =
                  matched && catBucket !== 'other'
                    ? catBucket
                    : matched?.category?.trim() || null

                return (
                  <li
                    key={row.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '16px',
                      background: '#ffffff',
                      borderRadius: '16px',
                      padding: '16px 20px',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      border: '1px solid #fce7f3',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: '0 0 8px', color: '#374151', lineHeight: 1.5, fontSize: '0.95rem' }}>
                        {label}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {catLabel && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              background: categoryStyle(catBucket === 'other' ? 'other' : catBucket).bg,
                              color: categoryStyle(catBucket === 'other' ? 'other' : catBucket).text,
                            }}
                          >
                            {catLabel}
                          </span>
                        )}
                        {isCustom && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: '999px',
                              background: '#ede9fe',
                              color: '#5b21b6',
                            }}
                          >
                            CUSTOM
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuestion(row)}
                      aria-label="Remove question"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#9ca3af',
                        fontSize: '1.5rem',
                        lineHeight: 1,
                        cursor: 'pointer',
                        padding: '0 4px',
                      }}
                    >
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
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
            {selectedTag ? ` in ${selectedTag}` : ''}
            {(personalizeByAge || personalizeByCondition) && ' (personalized)'}
          </p>
        )}

        {!loading && !error && saved.length === 0 && questions.length > 0 && (
          <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: '24px', fontSize: '0.9rem' }}>
            Tap the heart on a card to save it for your visit.
          </p>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
