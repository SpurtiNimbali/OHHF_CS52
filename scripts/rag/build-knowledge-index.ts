/**
 * Build `data/knowledge/index.json` from all JSON chunk files under each configured
 * corpus tree (recursive). Requires OPENAI_API_KEY. Run: npm run rag:build
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import OpenAI from 'openai'
import type { KnowledgeChunk, KnowledgeIndexFile, KnowledgeItem } from '../../server/lib/knowledge/types.js'
import {
  guessSourceUrlFromText,
  isLowValueChunk,
  normalizeChunkForKb,
  wordCount,
} from '../../server/lib/knowledge/normalize.js'

const ROOT = process.cwd()
loadEnv({ path: path.join(ROOT, '.env') })
loadEnv({ path: path.join(ROOT, '.env.local'), override: true })
const CHUNK_DIRS = [
  path.join(ROOT, 'corpus_cleaned_chunks'),
  path.join(ROOT, 'scripts', 'scrape_jina_corpus', 'corpus_cleaned_chunks'),
]
const OUT_DIR = path.join(ROOT, 'data', 'knowledge')
const OUT_FILE = path.join(OUT_DIR, 'index.json')
const EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small'
const BATCH = 64

type RawChunk = {
  chunk_id?: string
  text?: string
  title?: string
  source_url?: string
  sourceUrl?: string
  original_file?: string
  originalFile?: string
}

async function listChunkJsonFiles(): Promise<string[]> {
  const out: string[] = []
  for (const dir of CHUNK_DIRS) {
    try {
      const names = await fs.readdir(dir)
      for (const n of names) {
        if (n.endsWith('.json')) out.push(path.join(dir, n))
      }
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        console.warn(`[rag:build] skip missing directory: ${dir}`)
        continue
      }
      throw e
    }
  }
  return out
}

function toChunk(raw: RawChunk): KnowledgeChunk | null {
  const id = raw.chunk_id?.trim()
  const textRaw = raw.text ?? ''
  if (!id || !textRaw) return null

  const text = normalizeChunkForKb(textRaw)
  if (isLowValueChunk(text)) return null

  const url = String(raw.source_url ?? raw.sourceUrl ?? '').trim()
  const sourceUrl = url || guessSourceUrlFromText(text)
  const title = String(raw.title ?? 'Untitled').trim() || 'Untitled'
  const originalFile = String(raw.original_file ?? raw.originalFile ?? '').trim() || 'unknown'

  return { id, text, title, sourceUrl, originalFile }
}

async function embedBatches(chunks: KnowledgeChunk[]): Promise<number[][]> {
  const key = (process.env.OPENAI_API_KEY ?? '').trim()
  if (!key) {
    console.error('Set OPENAI_API_KEY in the environment.')
    process.exit(1)
  }
  const client = new OpenAI({ apiKey: key })
  const out: number[][] = []
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH)
    const input = slice.map((c) => c.text.slice(0, 30_000))
    process.stdout.write(`Embedding ${i + 1}–${i + slice.length} / ${chunks.length}…\n`)
    const res = await client.embeddings.create({ model: EMBED_MODEL, input })
    const batch = res.data
    batch.sort((a, b) => a.index - b.index)
    for (const row of batch) {
      if (row.embedding?.length) out.push(row.embedding)
    }
    if (batch.length !== slice.length) {
      throw new Error(`Embedding batch size mismatch at offset ${i}`)
    }
  }
  return out
}

async function main() {
  const files = await listChunkJsonFiles()
  console.log(`[rag:build] chunk JSON files: ${files.length}`)
  if (files.length === 0) {
    console.error('No chunk JSON files found. Expected dirs:', CHUNK_DIRS.join(', '))
    process.exit(1)
  }

  const byId = new Map<string, KnowledgeChunk>()

  for (const file of files) {
    const rawText = await fs.readFile(file, 'utf-8')
    const arr = JSON.parse(rawText) as RawChunk[]
    if (!Array.isArray(arr)) continue
    for (const r of arr) {
      const c = toChunk(r)
      if (!c) continue
      const prev = byId.get(c.id)
      if (!prev || wordCount(c.text) > wordCount(prev.text)) {
        byId.set(c.id, c)
      }
    }
  }

  const unique = [...byId.values()]
  unique.sort((a, b) => a.id.localeCompare(b.id))
  console.log(`Chunks after normalize/dedupe: ${unique.length}`)

  const vectors = await embedBatches(unique)
  if (vectors.length !== unique.length) {
    throw new Error('Embedding count does not match chunk count')
  }

  const items: KnowledgeItem[] = unique.map((c, i) => ({
    ...c,
    embedding: vectors[i]!,
  }))

  const payload: KnowledgeIndexFile = {
    embeddingModel: EMBED_MODEL,
    version: 1,
    builtAt: new Date().toISOString(),
    itemCount: items.length,
    items,
  }

  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.writeFile(OUT_FILE, JSON.stringify(payload), 'utf-8')
  console.log(`Wrote ${OUT_FILE} (${items.length} vectors, ${EMBED_MODEL})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
