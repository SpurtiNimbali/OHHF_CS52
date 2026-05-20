import fs from 'node:fs'
import path from 'node:path'

export type EmotionMapTool = { name: string; route: string; note?: string }

export type EmotionMapRow = {
  id: string
  feeling: string
  underneath: string
  modalities: string[]
  modalityReason: string
  exercise: { name: string; steps: string[] }
  benefits: string[]
  tools: EmotionMapTool[]
}

const VALID_IDS = new Set([
  'overwhelmed',
  'anxious',
  'exhausted',
  'guilty',
  'helpless',
  'angry',
  'scared',
  'numb',
  'disconnected',
  'unknown',
])

let cached: Map<string, EmotionMapRow> | null = null

export function loadEmotionMap(): Map<string, EmotionMapRow> {
  if (cached) return cached
  const p = path.join(process.cwd(), 'data', 'emotionMap.json')
  const raw = fs.readFileSync(p, 'utf-8')
  const rows = JSON.parse(raw) as EmotionMapRow[]
  cached = new Map()
  for (const r of rows) {
    if (r?.id && VALID_IDS.has(r.id)) {
      cached.set(r.id, r)
    }
  }
  return cached
}

export function safeDetectedEmotion(id: string | null | undefined): string | null {
  if (!id || !VALID_IDS.has(id)) return null
  return id
}

const MAX_UNDERNEATH_CHIPS = 10

/** Normalize chip text to consistent sentence case for UI (fixes mid-list lowercase fragments). */
export function formatChipOptionLabel(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ')
  if (!t) return t
  const lower = t.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/**
 * Split emotion map `underneath` copy into separate tap targets. Data uses comma lists,
 * sometimes with "and"/"or" before the last item (e.g. "..., information, and worry").
 */
export function splitUnderneathIntoChipOptions(underneath: string): string[] {
  const t = underneath.trim()
  if (!t) return []
  const segments = t.split(/\s*,\s*/)
  const out: string[] = []
  const seen = new Set<string>()
  for (let seg of segments) {
    seg = seg.replace(/^(?:and|or)\s+/i, '').trim()
    seg = seg.replace(/\s+(?:and|or)\s*$/i, '').trim()
    if (!seg) continue
    const label = formatChipOptionLabel(seg)
    const k = label.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(label)
    if (out.length >= MAX_UNDERNEATH_CHIPS) break
  }
  return out
}
