export function normalizeCategoryLabel(raw: string | number | null | undefined): string {
  if (raw == null) return ''
  return String(raw).trim()
}

export function normalizeExternalUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

/** Only allow http(s) URLs for clickable cards. */
export function safeExternalHref(raw: string | number | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  try {
    const u = new URL(normalizeExternalUrl(s))
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
  } catch {
    /* ignore */
  }
  return null
}
