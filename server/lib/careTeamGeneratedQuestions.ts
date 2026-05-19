import { randomUUID } from 'node:crypto'
import type { GeneratedCareTeamQuestion } from './careTeamQuestionGen.js'
import { getSupabaseAdmin } from './supabaseAdmin.js'
import type { CareTeamIntakePayload, UserProfilePayload } from '../prompts/careTeamQuestions.js'

export const GENERATED_QUESTIONS_TABLE = 'care_team_generated_questions'

const TTL_DAYS = Math.max(1, Number(process.env.CARE_TEAM_GENERATED_TTL_DAYS ?? 7) || 7)

export type StoredGeneratedQuestion = {
  id: string
  generationId: string
  position: number
  question: string
  category: string
  expiresAt: string
}

type DbRow = {
  id: string
  generation_id: string
  position: number
  question: string
  question_category: string
  expires_at: string
}

function toStored(row: DbRow): StoredGeneratedQuestion {
  return {
    id: row.id,
    generationId: row.generation_id,
    position: row.position,
    question: row.question,
    category: row.question_category,
    expiresAt: row.expires_at,
  }
}

function expiresAtIso(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + TTL_DAYS)
  return d.toISOString()
}

export async function purgeExpiredGeneratedQuestions(): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from(GENERATED_QUESTIONS_TABLE)
    .delete()
    .lt('expires_at', new Date().toISOString())

  if (error) {
    console.warn('[care-team-generated] purge expired failed:', error.message)
  }
}

export async function clearGeneratedQuestionsForUser(userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from(GENERATED_QUESTIONS_TABLE)
    .delete()
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to clear prior generated questions: ${error.message}`)
  }
}

export async function persistGeneratedQuestions(
  userId: string,
  questions: GeneratedCareTeamQuestion[],
  intake: CareTeamIntakePayload,
  profile: UserProfilePayload,
  model: string,
): Promise<{ generationId: string; expiresAt: string; questions: StoredGeneratedQuestion[] }> {
  await purgeExpiredGeneratedQuestions()
  await clearGeneratedQuestionsForUser(userId)

  const generationId = randomUUID()
  const expiresAt = expiresAtIso()

  const rows = questions.map((q, index) => ({
    user_id: userId,
    generation_id: generationId,
    position: index + 1,
    question: q.question,
    question_category: q.category,
    intake_snapshot: intake,
    profile_snapshot: profile,
    model,
    expires_at: expiresAt,
  }))

  const { data, error } = await getSupabaseAdmin()
    .from(GENERATED_QUESTIONS_TABLE)
    .insert(rows)
    .select('id, generation_id, position, question, question_category, expires_at')

  if (error) {
    throw new Error(`Failed to save generated questions: ${error.message}`)
  }

  const stored = ((data ?? []) as DbRow[])
    .sort((a, b) => a.position - b.position)
    .map(toStored)

  return { generationId, expiresAt, questions: stored }
}

export async function fetchLatestGeneratedQuestions(userId: string): Promise<{
  generationId: string | null
  expiresAt: string | null
  questions: StoredGeneratedQuestion[]
}> {
  await purgeExpiredGeneratedQuestions()

  const { data: head, error: headError } = await getSupabaseAdmin()
    .from(GENERATED_QUESTIONS_TABLE)
    .select('generation_id, expires_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (headError) {
    throw new Error(`Failed to load generated questions: ${headError.message}`)
  }

  if (!head?.generation_id) {
    return { generationId: null, expiresAt: null, questions: [] }
  }

  const { data: rows, error: rowsError } = await getSupabaseAdmin()
    .from(GENERATED_QUESTIONS_TABLE)
    .select('id, generation_id, position, question, question_category, expires_at')
    .eq('user_id', userId)
    .eq('generation_id', head.generation_id)
    .order('position', { ascending: true })

  if (rowsError) {
    throw new Error(`Failed to load generated questions: ${rowsError.message}`)
  }

  const questions = ((rows ?? []) as DbRow[]).map(toStored)

  return {
    generationId: head.generation_id,
    expiresAt: head.expires_at ?? questions[0]?.expiresAt ?? null,
    questions,
  }
}
