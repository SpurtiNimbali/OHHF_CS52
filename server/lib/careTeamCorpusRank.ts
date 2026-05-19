import type { CareTeamCorpusRow } from './careTeamCorpus.js'

export type IntakeForRanking = {
  providerTypes: string[]
  visitTypes: string[]
  targetPerson: string | null
  knowledgeLevel: string | null
}

function overlap(a: string[], b: string[]): boolean {
  const setB = new Set(b.map((s) => s.toLowerCase()))
  return a.some((x) => setB.has(x.toLowerCase()))
}

function targetPersonMatches(rowTarget: string, intakeTarget: string | null): boolean {
  if (!intakeTarget) return false
  if (intakeTarget === 'Child') {
    return rowTarget === 'Caregiver' || rowTarget === 'Teen' || rowTarget === 'Young Adult'
  }
  return rowTarget === intakeTarget
}

export function scoreCorpusRow(row: CareTeamCorpusRow, intake: IntakeForRanking): number {
  let score = 0

  if (typeof row.priority === 'number') {
    score += Math.max(0, 4 - row.priority) * 2
  }

  if (intake.providerTypes.length && overlap(row.provider_types ?? [], intake.providerTypes)) {
    score += 6
  }

  if (intake.visitTypes.length && overlap(row.visit_types ?? [], intake.visitTypes)) {
    score += 6
  }

  if (targetPersonMatches(row.target_person, intake.targetPerson)) {
    score += 4
  }

  if (intake.knowledgeLevel && row.knowledge_level === intake.knowledgeLevel) {
    score += 3
  }

  if (row.is_fallback) {
    score += 1
  }

  return score
}

export function rankCorpusForIntake(
  rows: CareTeamCorpusRow[],
  intake: IntakeForRanking,
  limit = 24,
): CareTeamCorpusRow[] {
  const scored = rows
    .map((row) => ({ row, score: scoreCorpusRow(row, intake) }))
    .sort((a, b) => b.score - a.score || a.row.question.localeCompare(b.row.question))

  const picked: CareTeamCorpusRow[] = []
  const seen = new Set<string>()

  for (const { row, score } of scored) {
    if (picked.length >= limit) break
    if (score <= 0 && picked.length >= 8) continue
    if (seen.has(row.slug)) continue
    seen.add(row.slug)
    picked.push(row)
  }

  if (picked.length < 8) {
    for (const row of rows) {
      if (picked.length >= limit) break
      if (seen.has(row.slug)) continue
      seen.add(row.slug)
      picked.push(row)
    }
  }

  return picked
}
