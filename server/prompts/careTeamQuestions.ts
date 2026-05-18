import type { CareTeamCorpusRow } from '../lib/careTeamCorpus.js'

export type CareTeamIntakePayload = {
  providerTypes: string[]
  visitTypes: string[]
  targetPerson: string | null
  targetPersonLabel: string | null
  knowledgeLevel: string | null
  knowledgeLevelLabel: string | null
  additionalNotes: string
}

export type UserProfilePayload = {
  diagnosisAgeCategory: string | null
  currentAgeCategory: string | null
  condition: string | null
}

export const CARE_TEAM_QUESTIONS_SYSTEM_PROMPT = `
You are Cardea, helping caregivers and families prepare questions for a health care visit related to pediatric or congenital heart care, or mental health care.

Your job: produce exactly 10 natural-language questions the user can ask their health care team at an upcoming visit.

Rules (non-negotiable):
- Output ONLY valid JSON (no markdown fences, no commentary before or after).
- Use this exact shape: {"questions":[{"question":"...","category":"..."}, ...]}
- Exactly 10 objects in "questions".
- "question" must be a complete, polite, specific question in plain English (one sentence, under around 200 characters).
- "category" must be one of: Big Picture, Clarification, Risk Assessment, Decision-Making, Planning Ahead, Monitoring, Advocacy, Emotional Support, Care Navigation, Transition Support, or General.
- Ground your work in the provided corpus examples and visit context. Adapt and combine ideas; only copy corpus questions verbatim if they are a perfect fit.
- Match the user's familiarity level: Beginner = simpler words, fewer assumptions; Experienced = can include more precise or technical terms with brief context.
- Match who the questions are for: parent/caregiver voice when preparing for a child; family-inclusive when relevant.
- Do not diagnose, prescribe, or give medical advice. Questions only.
- Include a mix of practical, emotional-advocacy, and logistics topics when appropriate.
- Be specific and avoid vague questions - lack of specificity can be frustrating for the user.
- Refer to user metadata implicitly and concisely rather than explicitly and word-for-word in any relevant questions. Real human beings don't provide that much detail word-for-wordin a natural-sounding question.
- Avoid asking the same question in slightly different terms.`

export function buildCareTeamQuestionsUserPrompt(
  intake: CareTeamIntakePayload,
  profile: UserProfilePayload,
  corpusRows: CareTeamCorpusRow[],
): string {
  const intakeBlock = [
    '## Visit intake (from form)',
    intake.providerTypes.length
      ? `Care team / specialties: ${intake.providerTypes.join('; ')}`
      : null,
    intake.visitTypes.length ? `Visit type(s): ${intake.visitTypes.join('; ')}` : null,
    intake.targetPersonLabel
      ? `Preparing questions for: ${intake.targetPersonLabel}`
      : null,
    intake.knowledgeLevelLabel
      ? `Familiarity with this type of visit: ${intake.knowledgeLevelLabel}`
      : null,
    intake.additionalNotes.trim() ? `Additional notes: ${intake.additionalNotes.trim()}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const profileBlock = [
    '## User profile (from onboarding, if available)',
    profile.currentAgeCategory
      ? `Child's current age category: ${profile.currentAgeCategory}`
      : null,
    profile.diagnosisAgeCategory
      ? `Age at diagnosis: ${profile.diagnosisAgeCategory}`
      : null,
    profile.condition ? `Reported condition / diagnosis areas: ${profile.condition}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const corpusBlock =
    corpusRows.length > 0
      ? [
          '## Question corpus (examples to ground tone, topics, and advocacy style)',
          'Use these as inspiration. Each line is one seed question with metadata.',
          ...corpusRows.map((row, i) => formatCorpusLine(i + 1, row)),
        ].join('\n')
      : '## Question corpus\n(No corpus rows loaded — use best judgment for congenital heart caregiver visits.)'

  return `${intakeBlock}\n\n${profileBlock}\n\n${corpusBlock}\n\nGenerate exactly 10 questions as JSON.`
}

function formatCorpusLine(index: number, row: CareTeamCorpusRow): string {
  const parts = [
    `[${index}]`,
    `Q: ${row.question}`,
    row.question_category ? `purpose: ${row.question_category}` : null,
    row.help_topics?.length ? `topics: ${row.help_topics.join(', ')}` : null,
    row.visit_types?.length ? `visits: ${row.visit_types.join(', ')}` : null,
    row.provider_types?.length ? `providers: ${row.provider_types.join(', ')}` : null,
    row.target_person ? `audience: ${row.target_person}` : null,
    row.knowledge_level ? `level: ${row.knowledge_level}` : null,
    row.grounding_phrase ? `tone hint: ${row.grounding_phrase}` : null,
  ].filter(Boolean)
  return parts.join(' | ')
}
