import { Router, type Request, type Response } from 'express'
import {
  fetchLatestGeneratedQuestions,
  persistGeneratedQuestions,
} from '../lib/careTeamGeneratedQuestions.js'
import { fetchCareTeamCorpus, getCareTeamCorpusCount, type CareTeamCorpusRow } from '../lib/careTeamCorpus.js'
import { generateCareTeamQuestions, getCareTeamGenerationModel } from '../lib/careTeamQuestionGen.js'
import type { CareTeamIntakePayload } from '../prompts/careTeamQuestions.js'

export type CareTeamCorpusListItem = {
  slug: string
  question: string
  question_category: string
  visit_types: string[]
  help_topics: string[]
  provider_types: string[]
  target_person: string
  knowledge_level: string
}

function toCorpusListItem(row: CareTeamCorpusRow): CareTeamCorpusListItem {
  return {
    slug: row.slug,
    question: row.question,
    question_category: row.question_category,
    visit_types: row.visit_types ?? [],
    help_topics: row.help_topics ?? [],
    provider_types: row.provider_types ?? [],
    target_person: row.target_person,
    knowledge_level: row.knowledge_level,
  }
}

const router = Router()

function isNonEmptyStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function parseUserId(queryOrBody: unknown): string | null {
  if (typeof queryOrBody === 'string' && queryOrBody.trim()) return queryOrBody.trim()
  return null
}

function parseIntakeBody(body: unknown): CareTeamIntakePayload | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const intake = b.intake
  if (!intake || typeof intake !== 'object') return null
  const i = intake as Record<string, unknown>

  const providerTypes = isNonEmptyStringArray(i.providerTypes) ? i.providerTypes : []
  const visitTypes = isNonEmptyStringArray(i.visitTypes) ? i.visitTypes : []
  const targetPerson = typeof i.targetPerson === 'string' ? i.targetPerson : null
  const knowledgeLevel = typeof i.knowledgeLevel === 'string' ? i.knowledgeLevel : null
  const additionalNotes = typeof i.additionalNotes === 'string' ? i.additionalNotes : ''

  if (!providerTypes.length || !visitTypes.length || !targetPerson?.trim() || !knowledgeLevel?.trim()) {
    return null
  }

  return {
    providerTypes,
    visitTypes,
    targetPerson,
    targetPersonLabel: typeof i.targetPersonLabel === 'string' ? i.targetPersonLabel : null,
    knowledgeLevel,
    knowledgeLevelLabel: typeof i.knowledgeLevelLabel === 'string' ? i.knowledgeLevelLabel : null,
    additionalNotes,
  }
}

function toApiQuestions(
  stored: { id: string; question: string; category: string; position: number }[],
): { id: string; question: string; category: string; position: number }[] {
  return stored.map((q) => ({
    id: q.id,
    question: q.question,
    category: q.category,
    position: q.position,
  }))
}

/** Read-only corpus listing for the standard-questions UI (service role on server). */
router.get('/corpus', async (_req: Request, res: Response) => {
  try {
    const rows = (await fetchCareTeamCorpus()).map(toCorpusListItem)
    const categories = [...new Set(rows.map((r) => r.question_category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
    return res.status(200).json({ questions: rows, categories })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load question corpus'
    console.error('[care-team-questions corpus]', e)
    return res.status(503).json({ error: message })
  }
})

/** Latest ephemeral generated batch for a user (service role on server). */
router.get('/generated', async (req: Request, res: Response) => {
  const userId = parseUserId(req.query.userId)
  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required.' })
  }

  try {
    const result = await fetchLatestGeneratedQuestions(userId)
    return res.status(200).json({
      generationId: result.generationId,
      expiresAt: result.expiresAt,
      questions: toApiQuestions(result.questions),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load generated questions'
    console.error('[care-team-questions generated]', e)
    return res.status(503).json({ error: message })
  }
})

/** Dev / sanity check: confirms service-role access to the question corpus. */
router.get('/corpus-health', async (_req: Request, res: Response) => {
  try {
    const count = await getCareTeamCorpusCount()
    const sample = (await fetchCareTeamCorpus()).slice(0, 3).map((row) => ({
      slug: row.slug,
      question: row.question,
    }))
    return res.status(200).json({ ok: true, count, sample })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Corpus check failed'
    console.error('[care-team-questions corpus-health]', e)
    return res.status(503).json({ ok: false, error: message })
  }
})

router.post('/generate', async (req: Request, res: Response) => {
  const intake = parseIntakeBody(req.body)
  if (!intake) {
    return res.status(400).json({ error: 'Complete intake form is required (care team, visit type, who, familiarity).' })
  }

  const userId =
    req.body && typeof req.body === 'object' ? parseUserId((req.body as { userId?: unknown }).userId) : null

  if (!userId) {
    return res.status(400).json({ error: 'Sign in is required to generate and store questions.' })
  }

  try {
    const { questions, profile } = await generateCareTeamQuestions({ userId, intake })
    const stored = await persistGeneratedQuestions(
      userId,
      questions,
      intake,
      profile,
      getCareTeamGenerationModel(),
    )

    return res.status(200).json({
      generationId: stored.generationId,
      expiresAt: stored.expiresAt,
      questions: toApiQuestions(stored.questions),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Question generation failed'
    console.error('[care-team-questions generate]', e)
    const status = message.includes('ANTHROPIC') ? 503 : 500
    return res.status(status).json({ error: message })
  }
})

export default router
