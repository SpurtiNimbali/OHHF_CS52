import { useEffect, useState } from 'react'
import { supabase, CardiologistQuestion, SavedQuestion } from '../lib/supabase'

const CURRENT_USER_ID = 'demo-user-id'

type GroupedQuestions = Record<string, CardiologistQuestion[]>

export default function QuestionsForCardiologist() {
  const [grouped, setGrouped] = useState<GroupedQuestions>({})
  const [saved, setSaved] = useState<SavedQuestion[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [customText, setCustomText] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: questions }, { data: savedRows }] = await Promise.all([
        supabase.from('cardiologist_questions').select('*').order('category'),
        supabase.from('saved_questions').select('*').eq('user_id', CURRENT_USER_ID),
      ])

      if (questions) {
        const groups: GroupedQuestions = {}
        for (const q of questions as CardiologistQuestion[]) {
          if (!groups[q.category]) groups[q.category] = []
          groups[q.category].push(q)
        }
        setGrouped(groups)
      }

      if (savedRows) {
        setSaved(savedRows as SavedQuestion[])
        setSavedIds(new Set((savedRows as SavedQuestion[]).map((r) => r.question_id ?? '')))
      }

      setLoading(false)
    }
    load()
  }, [])

  async function toggleQuestion(question: CardiologistQuestion) {
    if (savedIds.has(question.id)) {
      await supabase
        .from('saved_questions')
        .delete()
        .eq('user_id', CURRENT_USER_ID)
        .eq('question_id', question.id)

      setSavedIds((prev) => {
        const next = new Set(prev)
        next.delete(question.id)
        return next
      })
      setSaved((prev) => prev.filter((r) => r.question_id !== question.id))
    } else {
      const row = { user_id: CURRENT_USER_ID, question_id: question.id, custom_text: null }
      const { data } = await supabase.from('saved_questions').upsert(row).select().single()

      setSavedIds((prev) => new Set([...prev, question.id]))
      if (data) setSaved((prev) => [...prev, data as SavedQuestion])
    }
  }

  async function addCustomQuestion() {
    if (!customText.trim()) return
    setAdding(true)
    const row = { user_id: CURRENT_USER_ID, question_id: null, custom_text: customText.trim() }
    const { data } = await supabase.from('saved_questions').insert(row).select().single()
    if (data) setSaved((prev) => [...prev, data as SavedQuestion])
    setCustomText('')
    setAdding(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Loading questions...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold text-rose-700">Questions for Your Cardiologist</h1>

      {Object.entries(grouped).map(([category, questions]) => (
        <section key={category}>
          <h2 className="text-lg font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1">
            {category}
          </h2>
          <ul className="space-y-2">
            {questions.map((q) => (
              <li key={q.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={q.id}
                  checked={savedIds.has(q.id)}
                  onChange={() => toggleQuestion(q)}
                  className="mt-1 h-4 w-4 accent-rose-600 cursor-pointer"
                />
                <label htmlFor={q.id} className="text-sm text-gray-800 cursor-pointer leading-snug">
                  {q.question_text}
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1">
          Add Your Own
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomQuestion()}
            placeholder="Type your question..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
          />
          <button
            onClick={addCustomQuestion}
            disabled={adding || !customText.trim()}
            className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>
      </section>

      {saved.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1">
            Saved ({saved.length})
          </h2>
          <ul className="space-y-2">
            {saved.map((row) => {
              const label =
                row.custom_text ??
                Object.values(grouped)
                  .flat()
                  .find((q) => q.id === row.question_id)?.question_text ??
                ''
              return (
                <li
                  key={row.id}
                  className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 text-sm text-gray-800"
                >
                  <span className="text-rose-500 mt-0.5">✓</span>
                  <span>{label}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
