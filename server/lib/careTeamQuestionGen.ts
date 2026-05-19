import Anthropic from '@anthropic-ai/sdk'
import {
  buildCareTeamQuestionsUserPrompt,
  CARE_TEAM_QUESTIONS_SYSTEM_PROMPT,
  type CareTeamIntakePayload,
  type UserProfilePayload,
} from '../prompts/careTeamQuestions.js'
import { fetchCareTeamCorpus, type CareTeamCorpusRow } from './careTeamCorpus.js'
import { rankCorpusForIntake } from './careTeamCorpusRank.js'
import { getSupabaseAdmin } from './supabaseAdmin.js'

const MAIN_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6'

export type GeneratedCareTeamQuestion = {
  question: string
  category: string
}

export type GenerateCareTeamQuestionsInput = {
  userId: string | null
  intake: CareTeamIntakePayload
}

let anthropic: Anthropic | null = null

function getAnthropic(): Anthropic {
  if (!anthropic) {
    const key = (process.env.ANTHROPIC_API_KEY ?? '').trim()
    if (!key) throw new Error('Missing ANTHROPIC_API_KEY')
    anthropic = new Anthropic({ apiKey: key })
  }
  return anthropic
}

function anthropicText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((b) => {
      if (!b || typeof b !== 'object') return ''
      const block = b as { type?: unknown; text?: unknown }
      if (block.type === 'text' && typeof block.text === 'string') return block.text
      return ''
    })
    .join('')
}

async function claudeJson(system: string, user: string): Promise<string> {
  const res = await getAnthropic().messages.create({
    model: MAIN_MODEL,
    max_tokens: 2800,
    temperature: 0.45,
    system,
    messages: [{ role: 'user', content: user }],
  })
  return anthropicText(res.content).trim()
}

async function fetchUserProfile(userId: string | null): Promise<UserProfilePayload> {
  if (!userId?.trim()) {
    return { diagnosisAgeCategory: null, currentAgeCategory: null, condition: null }
  }

  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('diagnosis_age_category, current_age_category, condition')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[care-team-questions] profile load failed:', error.message)
    return { diagnosisAgeCategory: null, currentAgeCategory: null, condition: null }
  }

  const row = data as {
    diagnosis_age_category?: string | null
    current_age_category?: string | null
    condition?: string | null
  } | null

  return {
    diagnosisAgeCategory: row?.diagnosis_age_category ?? null,
    currentAgeCategory: row?.current_age_category ?? null,
    condition: row?.condition ?? null,
  }
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence?.[1]?.trim() ?? trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('Model response did not contain JSON')
  }
  return JSON.parse(candidate.slice(start, end + 1))
}

function normalizeCategory(raw: unknown): string {
  const s = String(raw ?? '').trim()
  const allowed = [
    'Big Picture',
    'Clarification',
    'Risk Assessment',
    'Decision-Making',
    'Planning Ahead',
    'Monitoring',
    'Advocacy',
    'Emotional Support',
    'Care Navigation',
    'Transition Support',
    'General',
  ]
  const match = allowed.find((a) => a.toLowerCase() === s.toLowerCase())
  return match ?? (s || 'General')
}

function parseQuestionsPayload(raw: string): GeneratedCareTeamQuestion[] {
  const parsed = extractJsonObject(raw) as { questions?: unknown }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.questions)) {
    throw new Error('Invalid JSON shape from model')
  }

  const out: GeneratedCareTeamQuestion[] = []
  const seen = new Set<string>()

  for (const item of parsed.questions) {
    if (!item || typeof item !== 'object') continue
    const q = String((item as { question?: unknown }).question ?? '').trim()
    if (!q) continue
    const key = q.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      question: q,
      category: normalizeCategory((item as { category?: unknown }).category),
    })
    if (out.length >= 10) break
  }

  if (out.length === 0) {
    throw new Error('Model returned no usable questions')
  }

  return out
}

export type GenerateCareTeamQuestionsResult = {
  questions: GeneratedCareTeamQuestion[]
  profile: UserProfilePayload
}

export async function generateCareTeamQuestions(
  input: GenerateCareTeamQuestionsInput,
): Promise<GenerateCareTeamQuestionsResult> {
  const intake = input.intake
  const profile = await fetchUserProfile(input.userId)

  const corpus = await fetchCareTeamCorpus()
  const ranked = rankCorpusForIntake(corpus, {
    providerTypes: intake.providerTypes,
    visitTypes: intake.visitTypes,
    targetPerson: intake.targetPerson,
    knowledgeLevel: intake.knowledgeLevel,
  })

  const userPrompt = buildCareTeamQuestionsUserPrompt(intake, profile, ranked)
  const raw = await claudeJson(CARE_TEAM_QUESTIONS_SYSTEM_PROMPT, userPrompt)
  const questions = parseQuestionsPayload(raw)

  if (questions.length < 10) {
    console.warn(`[care-team-questions] model returned ${questions.length} questions; expected 10`)
  }

  return { questions: questions.slice(0, 10), profile }
}

export function getCareTeamGenerationModel(): string {
  return MAIN_MODEL
}

export type { CareTeamCorpusRow }
