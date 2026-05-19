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

export type CareTeamCorpusResponse = {
  questions: CareTeamCorpusListItem[]
  categories: string[]
}

export async function fetchCareTeamCorpusList(): Promise<CareTeamCorpusResponse> {
  const res = await fetch('/api/care-team-questions/corpus')
  const data = (await res.json().catch(() => ({}))) as CareTeamCorpusResponse & { error?: string }

  if (!res.ok) {
    throw new Error(data.error ?? `Failed to load standard questions (${res.status})`)
  }

  if (!Array.isArray(data.questions)) {
    throw new Error('Invalid corpus response')
  }

  return {
    questions: data.questions,
    categories: Array.isArray(data.categories) ? data.categories : [],
  }
}
