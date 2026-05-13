/**
 * Normalizes raw chunk text for embedding + retrieval.
 * Used by the RAG build script and kept server-side for consistency.
 */

const URL_IN_TEXT = /https?:\/\/[^\s\])"'<>]+/gi

/** First plausible URL in text (for citation when scraper left source_url blank). */
export function guessSourceUrlFromText(text: string): string {
  URL_IN_TEXT.lastIndex = 0
  const m = URL_IN_TEXT.exec(text)
  return (m?.[0] ?? '').replace(/[.,;:)]+$/, '')
}

export function normalizeChunkForKb(raw: string): string {
  let t = raw.replace(/\r\n/g, '\n').trim()
  // Drop image-only markdown lines
  t = t.replace(/^\s*!\[[^\]]*]\([^)]+\)\s*$/gm, '')
  // Collapse excessive blank lines
  t = t.replace(/\n{3,}/g, '\n\n')
  // Normalize spaces
  t = t.replace(/[ \t]+/g, ' ')
  t = t.replace(/^[ \t]+/gm, '')
  return t.trim()
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/** Skip chunks that are mostly chrome / too thin after normalize. */
export function isLowValueChunk(text: string): boolean {
  if (wordCount(text) < 40) return true
  const lower = text.slice(0, 2000).toLowerCase()
  if (
    lower.includes('open search menu') &&
    lower.includes('close mobile menu') &&
    lower.includes('utility nav')
  ) {
    return wordCount(text) < 120
  }
  return false
}
