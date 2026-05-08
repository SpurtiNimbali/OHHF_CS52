import fs from 'node:fs/promises'
import path from 'node:path'
import type { KnowledgeIndexFile, KnowledgeItem } from './types.js'

let cache: KnowledgeItem[] | null = null
let loadError: string | null = null

export function knowledgeIndexPath(): string {
  return path.join(process.cwd(), 'data', 'knowledge', 'index.json')
}

export async function loadKnowledgeIndex(): Promise<KnowledgeItem[]> {
  if (cache) return cache
  const p = knowledgeIndexPath()
  try {
    const raw = await fs.readFile(p, 'utf-8')
    const data = JSON.parse(raw) as KnowledgeIndexFile
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('Knowledge index has no items')
    }
    cache = data.items
    loadError = null
    return cache
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    loadError = msg
    console.warn(`[knowledge] Could not load index at ${p}: ${msg}`)
    cache = []
    return cache
  }
}

export function getKnowledgeLoadError(): string | null {
  return loadError
}

export function clearKnowledgeCache(): void {
  cache = null
  loadError = null
}
