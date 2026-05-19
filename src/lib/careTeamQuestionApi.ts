import type { CareTeamIntakeAnswers } from './careTeamQuestionIntake'
import { CARE_TEAM_KNOWLEDGE_OPTIONS, CARE_TEAM_TARGET_PERSON_OPTIONS } from './careTeamQuestionIntake'

export type GeneratedCareTeamQuestion = {
  id: string
  question: string
  category: string
  position: number
}

export type GeneratedCareTeamBatch = {
  generationId: string | null
  expiresAt: string | null
  questions: GeneratedCareTeamQuestion[]
}

function intakeLabels(intake: CareTeamIntakeAnswers) {
  const targetPersonLabel =
    CARE_TEAM_TARGET_PERSON_OPTIONS.find((o) => o.value === intake.targetPerson)?.label ?? null
  const knowledgeLevelLabel =
    CARE_TEAM_KNOWLEDGE_OPTIONS.find((o) => o.value === intake.knowledgeLevel)?.label ?? null
  return { targetPersonLabel, knowledgeLevelLabel }
}

function normalizeQuestions(raw: unknown): GeneratedCareTeamQuestion[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const question = typeof row.question === 'string' ? row.question.trim() : ''
      if (!question) return null
      return {
        id: typeof row.id === 'string' ? row.id : '',
        question,
        category: typeof row.category === 'string' ? row.category.trim() || 'General' : 'General',
        position: typeof row.position === 'number' ? row.position : 0,
      }
    })
    .filter((q): q is GeneratedCareTeamQuestion => q !== null)
    .sort((a, b) => a.position - b.position)
}

export async function fetchLatestGeneratedQuestionsFromApi(
  userId: string,
): Promise<GeneratedCareTeamBatch> {
  const params = new URLSearchParams({ userId })
  const res = await fetch(`/api/care-team-questions/generated?${params}`)
  const data = (await res.json().catch(() => ({}))) as GeneratedCareTeamBatch & { error?: string }

  if (!res.ok) {
    throw new Error(data.error ?? `Failed to load generated questions (${res.status})`)
  }

  return {
    generationId: data.generationId ?? null,
    expiresAt: data.expiresAt ?? null,
    questions: normalizeQuestions(data.questions),
  }
}

export async function generateCareTeamQuestionsFromApi(
  intake: CareTeamIntakeAnswers,
  userId: string | null,
): Promise<GeneratedCareTeamBatch> {
  if (!userId) {
    throw new Error('Sign in is required to generate questions.')
  }

  const { targetPersonLabel, knowledgeLevelLabel } = intakeLabels(intake)

  const res = await fetch('/api/care-team-questions/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      intake: {
        providerTypes: intake.providerTypes,
        visitTypes: intake.visitTypes,
        targetPerson: intake.targetPerson,
        targetPersonLabel,
        knowledgeLevel: intake.knowledgeLevel,
        knowledgeLevelLabel,
        additionalNotes: intake.additionalNotes,
      },
    }),
  })

  const data = (await res.json().catch(() => ({}))) as GeneratedCareTeamBatch & { error?: string }

  if (!res.ok) {
    throw new Error(data.error ?? `Generation failed (${res.status})`)
  }

  const questions = normalizeQuestions(data.questions)
  if (questions.length === 0) {
    throw new Error('No questions returned. Try again in a moment.')
  }

  return {
    generationId: data.generationId ?? null,
    expiresAt: data.expiresAt ?? null,
    questions,
  }
}
