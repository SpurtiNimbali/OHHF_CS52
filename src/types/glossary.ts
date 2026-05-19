/** Display order for glossary category filters (matches Supabase dataset). */
export const GLOSSARY_CATEGORIES = [
  'Conditions',
  'Procedures & Surgeries',
  'Tests & Imaging',
  'Medications',
  'Devices & Equipment',
  'Anatomy',
  'Systems & Monitoring',
  'Hospital & Care Journey',
  'Caregiver Support',
  'General Medical Terms',
] as const

export type GlossaryCategory = (typeof GLOSSARY_CATEGORIES)[number]

export const GLOSSARY_SELECT =
  'id, term, slug, aliases, categories, short_definition, full_definition'

export type GlossaryTermRow = {
  id: string | number
  term: string
  slug: string | null
  aliases: unknown
  categories: string[] | null
  short_definition: string | null
  full_definition: string | null
}

export function normalizeGlossaryCategories(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        return normalizeGlossaryCategories(JSON.parse(trimmed) as unknown)
      } catch {
        /* fall through */
      }
    }
    return trimmed
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

export function normalizeGlossaryAliases(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        return normalizeGlossaryAliases(JSON.parse(trimmed) as unknown)
      } catch {
        /* fall through */
      }
    }
    return trimmed
      .split(/[,;|]/)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

export function glossaryShortText(row: GlossaryTermRow): string {
  return row.short_definition?.trim() || ''
}

export function glossaryFullText(row: GlossaryTermRow): string {
  return row.full_definition?.trim() || row.short_definition?.trim() || ''
}

export function termMatchesSearch(row: GlossaryTermRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (row.term.toLowerCase().includes(q)) return true
  if (row.slug?.toLowerCase().includes(q)) return true
  if (normalizeGlossaryAliases(row.aliases).some((alias) => alias.toLowerCase().includes(q))) {
    return true
  }
  const aliasBlob =
    typeof row.aliases === 'string' ? row.aliases.toLowerCase() : ''
  if (aliasBlob.includes(q)) return true
  if (glossaryShortText(row).toLowerCase().includes(q)) return true
  if (glossaryFullText(row).toLowerCase().includes(q)) return true
  return false
}

export function termMatchesCategory(row: GlossaryTermRow, category: string | null): boolean {
  if (!category) return true
  const cats = normalizeGlossaryCategories(row.categories)
  return cats.includes(category)
}
