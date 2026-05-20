import { useEffect, useMemo, useState } from 'react'
import {
  ResourcesPageEmpty,
  ResourcesPageError,
  ResourcesPageLoading,
} from '../components/ResourcesPageStates'
import { fetchCareTeamCorpusList, type CareTeamCorpusListItem } from '../lib/careTeamCorpusApi'

const NAVY = '#192b3f'
const DARK_GREEN = '#577568'
const MUTED_GREEN = '#acb7a8'

const FALLBACK_QUESTIONS: CareTeamCorpusListItem[] = [
  { slug: 'f-1',  question: 'What is my child\'s current diagnosis and has anything changed since our last visit?', question_category: 'Diagnosis & Condition', visit_types: ['Cardiology Visit'], provider_types: ['Cardiologist'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-2',  question: 'Can you explain the diagnosis in plain language without medical jargon?', question_category: 'Diagnosis & Condition', visit_types: ['Cardiology Visit'], provider_types: ['Cardiologist'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-3',  question: 'Are there any new research findings or treatment options we should know about?', question_category: 'Diagnosis & Condition', visit_types: ['Cardiology Visit', 'Second Opinion'], provider_types: ['Cardiologist'], target_person: 'Caregiver', knowledge_level: 'Experienced', help_topics: [] },
  { slug: 'f-4',  question: 'What tests or imaging are scheduled for today and when will we receive the results?', question_category: 'Tests & Monitoring', visit_types: ['Cardiology Visit'], provider_types: ['Cardiologist'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-5',  question: 'How often should we schedule follow-up appointments and what should we monitor at home?', question_category: 'Tests & Monitoring', visit_types: ['Cardiology Visit', 'Post-Discharge Follow-up'], provider_types: ['Cardiologist'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-6',  question: 'What are the target ranges for oxygen levels, heart rate, and weight that should prompt a call?', question_category: 'Tests & Monitoring', visit_types: ['Post-Discharge Follow-up'], provider_types: ['Cardiologist', 'Nurse'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-7',  question: 'What medications is my child currently taking and what are the side effects to watch for?', question_category: 'Medications', visit_types: ['Cardiology Visit'], provider_types: ['Cardiologist', 'Primary Care Provider'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-8',  question: 'What should we do if a dose is missed or my child vomits after taking medication?', question_category: 'Medications', visit_types: ['Cardiology Visit'], provider_types: ['Cardiologist', 'Nurse'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-9',  question: 'Are there any over-the-counter medicines, vitamins, or foods to avoid?', question_category: 'Medications', visit_types: ['Cardiology Visit', 'Primary Care Visit'], provider_types: ['Cardiologist', 'Pharmacist'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-10', question: 'What are the risks and benefits of this surgery, and what happens if we delay or don\'t proceed?', question_category: 'Surgery & Procedures', visit_types: ['Surgery Consultation'], provider_types: ['Surgeon', 'Cardiologist'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-11', question: 'What does recovery look like — how long, what activity restrictions, and what is the pain management plan?', question_category: 'Surgery & Procedures', visit_types: ['Surgery Consultation', 'Post-Discharge Follow-up'], provider_types: ['Surgeon'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-12', question: 'Will my child need additional surgeries or procedures in the future?', question_category: 'Surgery & Procedures', visit_types: ['Surgery Consultation', 'Cardiology Visit'], provider_types: ['Surgeon', 'Cardiologist'], target_person: 'Caregiver', knowledge_level: 'Intermediate', help_topics: [] },
  { slug: 'f-13', question: 'What warning signs or symptoms should prompt us to call the care team or go to the ER immediately?', question_category: 'Safety & Emergency', visit_types: ['Cardiology Visit', 'Post-Discharge Follow-up'], provider_types: ['Cardiologist', 'Nurse'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-14', question: 'What is the emergency action plan if my child turns blue, loses consciousness, or stops breathing?', question_category: 'Safety & Emergency', visit_types: ['Cardiology Visit'], provider_types: ['Cardiologist', 'Nurse'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-15', question: 'Should my child wear a medical alert bracelet?', question_category: 'Safety & Emergency', visit_types: ['Cardiology Visit'], provider_types: ['Cardiologist'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-16', question: 'Are there activity restrictions — sports, PE class, travel — we need to follow?', question_category: 'Daily Life & Activity', visit_types: ['Cardiology Visit', 'School / Sports Clearance'], provider_types: ['Cardiologist', 'School Staff'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-17', question: 'Are there diet or nutrition recommendations that support my child\'s heart health?', question_category: 'Daily Life & Activity', visit_types: ['Cardiology Visit', 'Primary Care Visit'], provider_types: ['Cardiologist', 'Pediatrician'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-18', question: 'What information should we share with the school nurse, teachers, or coaches?', question_category: 'Daily Life & Activity', visit_types: ['School / Sports Clearance'], provider_types: ['School Staff', 'Care Coordinator'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-19', question: 'How does this condition affect my child\'s long-term heart function and overall life expectancy?', question_category: 'Long-term Outlook', visit_types: ['Cardiology Visit'], provider_types: ['Cardiologist'], target_person: 'Caregiver', knowledge_level: 'Intermediate', help_topics: [] },
  { slug: 'f-20', question: 'What should we expect as my child transitions into adult cardiac care?', question_category: 'Long-term Outlook', visit_types: ['Transition to Adult Care'], provider_types: ['Cardiologist', 'Care Coordinator'], target_person: 'Caregiver', knowledge_level: 'Intermediate', help_topics: [] },
  { slug: 'f-21', question: 'Are there support groups or other families in similar situations you can connect us with?', question_category: 'Mental Health & Support', visit_types: ['Cardiology Visit', 'Mental Health Support'], provider_types: ['Care Coordinator', 'Mental Health Provider'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-22', question: 'What resources are available to help manage caregiver stress and burnout?', question_category: 'Mental Health & Support', visit_types: ['Mental Health Support'], provider_types: ['Mental Health Provider', 'Care Coordinator'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-23', question: 'How do we help our child understand and cope emotionally with their heart condition?', question_category: 'Mental Health & Support', visit_types: ['Mental Health Support', 'Cardiology Visit'], provider_types: ['Mental Health Provider', 'Cardiologist'], target_person: 'Child', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-24', question: 'What should we do to prepare for the next appointment and who do we contact with questions between visits?', question_category: 'Follow-up Care', visit_types: ['Cardiology Visit', 'Post-Discharge Follow-up'], provider_types: ['Cardiologist', 'Nurse'], target_person: 'Caregiver', knowledge_level: 'Beginner', help_topics: [] },
  { slug: 'f-25', question: 'Is a second opinion recommended, and can you refer us to another specialist?', question_category: 'Follow-up Care', visit_types: ['Second Opinion'], provider_types: ['Cardiologist'], target_person: 'Caregiver', knowledge_level: 'Intermediate', help_topics: [] },
]

const FALLBACK_CATEGORIES = [...new Set(FALLBACK_QUESTIONS.map((q) => q.question_category))].sort()

function groupByCategory(questions: CareTeamCorpusListItem[]): Map<string, CareTeamCorpusListItem[]> {
  const map = new Map<string, CareTeamCorpusListItem[]>()
  for (const q of questions) {
    const cat = q.question_category?.trim() || 'General'
    const list = map.get(cat) ?? []
    list.push(q)
    map.set(cat, list)
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.question.localeCompare(b.question))
  }
  return map
}

export default function StandardCareTeamQuestions() {
  const [questions, setQuestions] = useState<CareTeamCorpusListItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchCareTeamCorpusList()
        if (cancelled) return
        setQuestions(data.questions)
        setCategories(data.categories)
      } catch {
        if (!cancelled) {
          setQuestions(FALLBACK_QUESTIONS)
          setCategories(FALLBACK_CATEGORIES)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!selectedCategory) return questions
    return questions.filter((q) => q.question_category === selectedCategory)
  }, [questions, selectedCategory])

  const grouped = useMemo(() => groupByCategory(filtered), [filtered])

  const sortedCategoryKeys = useMemo(() => [...grouped.keys()].sort((a, b) => a.localeCompare(b)), [grouped])

  if (loading) {
    return <ResourcesPageLoading label="Loading standard questions…" />
  }

  if (error) {
    return <ResourcesPageError message={error} onRetry={() => window.location.reload()} />
  }

  if (questions.length === 0) {
    return (
      <ResourcesPageEmpty
        title="No standard questions yet"
        description="The question library has not been loaded."
      />
    )
  }

  return (
    <div className="-mx-2 w-full sm:mx-0" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: NAVY }}>
      <div className="mb-6">
        <h1
          className="mb-2 text-3xl tracking-wide text-[#192b3f] sm:text-4xl"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}
        >
          STANDARD QUESTIONS
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: MUTED_GREEN }}>
          Browse our library of caregiver-tested questions, organized by purpose. Use these as inspiration for your
          next visit or with Generate Questions for a personalized list.
        </p>
      </div>

      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
              selectedCategory === null ? 'text-white' : 'bg-white/90 text-[#192b3f]'
            }`}
            style={
              selectedCategory === null
                ? { background: DARK_GREEN, borderColor: DARK_GREEN }
                : { borderColor: 'rgba(25, 43, 63, 0.15)' }
            }
          >
            All ({questions.length})
          </button>
          {categories.map((cat) => {
            const count = questions.filter((q) => q.question_category === cat).length
            const on = selectedCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                  on ? 'text-white' : 'bg-white/90 text-[#192b3f]'
                }`}
                style={on ? { background: DARK_GREEN, borderColor: DARK_GREEN } : { borderColor: 'rgba(25, 43, 63, 0.15)' }}
              >
                {cat} ({count})
              </button>
            )
          })}
        </div>
      )}

      <div className="space-y-10">
        {sortedCategoryKeys.map((category) => {
          const items = grouped.get(category) ?? []
          return (
            <section key={category}>
              <h2 className="mb-4 text-lg font-semibold text-[#192b3f]">{category}</h2>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.slug}
                    className="rounded-xl border bg-white p-4 shadow-sm"
                    style={{ borderColor: 'rgba(25, 43, 63, 0.1)' }}
                  >
                    <p className="text-sm font-medium leading-snug text-[#192b3f]">{item.question}</p>
                    {(item.visit_types.length > 0 || item.provider_types.length > 0) && (
                      <p className="mt-2 text-xs leading-relaxed" style={{ color: MUTED_GREEN }}>
                        {item.visit_types.length > 0 && (
                          <span>
                            <span className="font-semibold">Visits:</span> {item.visit_types.join(' · ')}
                          </span>
                        )}
                        {item.visit_types.length > 0 && item.provider_types.length > 0 && ' · '}
                        {item.provider_types.length > 0 && (
                          <span>
                            <span className="font-semibold">Care team:</span> {item.provider_types.join(' · ')}
                          </span>
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-sm italic" style={{ color: MUTED_GREEN }}>
          No questions in this category.
        </p>
      )}
    </div>
  )
}
