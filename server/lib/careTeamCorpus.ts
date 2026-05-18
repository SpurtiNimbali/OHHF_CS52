import { getSupabaseAdmin } from './supabaseAdmin.js'

export const CARE_TEAM_CORPUS_TABLE = 'care_team_questions__corpus'

export type CareTeamCorpusRow = {
  id?: string
  question: string
  slug: string
  visit_types: string[]
  emotional_contexts: string[]
  help_topics: string[]
  target_person: string
  knowledge_level: string
  question_category: string
  provider_types: string[]
  grounding_phrase: string | null
  freeze_script: string | null
  source_name: string
  source_url: string | null
  source_type: string
  priority: number
  is_fallback: boolean
  tags: string[]
}

export async function fetchCareTeamCorpus(): Promise<CareTeamCorpusRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from(CARE_TEAM_CORPUS_TABLE)
    .select('*')
    .order('priority', { ascending: true })
    .order('question', { ascending: true })

  if (error) {
    throw new Error(`Failed to load care team corpus: ${error.message}`)
  }

  return (data ?? []) as CareTeamCorpusRow[]
}

export async function getCareTeamCorpusCount(): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from(CARE_TEAM_CORPUS_TABLE)
    .select('*', { count: 'exact', head: true })

  if (error) {
    throw new Error(`Failed to count care team corpus: ${error.message}`)
  }

  return count ?? 0
}
