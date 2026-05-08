import type { KnowledgeItem, RetrievedChunk } from './types.js'

function dot(a: number[], b: number[]): number {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

function norm(a: number[]): number {
  return Math.sqrt(dot(a, a)) || 1
}

export function embedQueryToScores(
  queryEmbedding: number[],
  items: KnowledgeItem[],
  topK: number,
): RetrievedChunk[] {
  const qn = norm(queryEmbedding)
  const scored = items.map((item) => {
    const score = dot(queryEmbedding, item.embedding) / (qn * norm(item.embedding))
    const { embedding: _, ...chunk } = item
    return { ...chunk, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}
