import type { SupportResource } from './supabase'

/** Matches `welcomeScreen` onboarding age options. */
export const ONBOARDING_AGE_CATEGORIES = [
  'Prenatal',
  'Infant (1 and under)',
  'Preschooler (2-5)',
  'School Age (6-12)',
  'Teen (13-17)',
  'Young Adult (18-39)',
  'Adult (40+)',
] as const

export type OnboardingAgeCategory = (typeof ONBOARDING_AGE_CATEGORIES)[number]

export const SUPPORT_FILTER_CATEGORIES = [
  'Family Support',
  'Mental Health',
  'Camp',
  'Financial Aid',
] as const

export type SupportFilterCategory = (typeof SUPPORT_FILTER_CATEGORIES)[number]

function pickString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = row[key]
    if (v == null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return null
}

/** Map a Supabase row (supports legacy `city` / `zip_code` column names). */
export function mapSupportResourceRow(row: Record<string, unknown>): SupportResource {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    description: pickString(row, 'description') ?? '',
    link: pickString(row, 'link') ?? '',
    category: pickString(row, 'category') ?? '',
    location: pickString(row, 'location', 'city'),
    zipcode: pickString(row, 'zipcode', 'zip_code', 'zip code'),
    age: pickString(row, 'age'),
  }
}

export function normalizeSupportCategory(
  raw: string | number | null | undefined,
): SupportFilterCategory | 'other' {
  const label = String(raw ?? '').trim()
  if (!label) return 'other'
  const key = SUPPORT_FILTER_CATEGORIES.find((c) => c.toLowerCase() === label.toLowerCase())
  return key ?? 'other'
}

/** Split resource `age` into onboarding labels (comma- or semicolon-separated). */
export function parseResourceAgeTags(age: string | null | undefined): string[] {
  if (!age?.trim()) return []
  return age
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * True when a resource has no age restriction, or lists the child's current age.
 * When `childCurrentAge` is missing, only unrestricted resources match.
 */
export function resourceMatchesChildAge(
  resourceAge: string | null | undefined,
  childCurrentAge: string | null | undefined,
): boolean {
  const tags = parseResourceAgeTags(resourceAge)
  if (tags.length === 0) return true

  const child = childCurrentAge?.trim()
  if (!child) return false

  const childLower = child.toLowerCase()
  return tags.some((tag) => tag.toLowerCase() === childLower)
}

export function formatSupportResourceLocation(resource: SupportResource): string | null {
  const loc = resource.location?.trim()
  const zip = resource.zipcode?.trim()

  if (loc && /^online$/i.test(loc)) return 'Online'

  const parts: string[] = []
  if (loc) parts.push(loc)
  if (zip) parts.push(zip)
  return parts.length > 0 ? parts.join(', ') : null
}

export function resourceMatchesLocationQuery(resource: SupportResource, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const name = String(resource.name ?? '').toLowerCase()
  const desc = String(resource.description ?? '').toLowerCase()
  const loc = String(resource.location ?? '').toLowerCase()
  const zip = String(resource.zipcode ?? '').toLowerCase()

  if (name.includes(q) || desc.includes(q)) return true
  if (loc === q || zip === q) return true
  if (loc.startsWith(q) || zip.startsWith(q)) return true
  if (loc.includes(q) || zip.includes(q)) return true
  if (/^online$/i.test(q) && /^online$/i.test(resource.location ?? '')) return true

  const hasLocation = Boolean(loc || zip)
  if (!hasLocation && (name.includes(q) || desc.includes(q))) return true

  return false
}

export function scoreResourceLocationMatch(resource: SupportResource, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0

  const name = String(resource.name ?? '').toLowerCase()
  const desc = String(resource.description ?? '').toLowerCase()
  const loc = String(resource.location ?? '').toLowerCase()
  const zip = String(resource.zipcode ?? '').toLowerCase()
  const online = /^online$/i.test(resource.location ?? '')

  if (loc === q || zip === q || (q === 'online' && online)) return 0
  if (loc.startsWith(q) || zip.startsWith(q)) return 1
  if (loc.includes(q) || zip.includes(q)) return 2
  if (name.includes(q) || desc.includes(q)) return 3
  if (!loc && !zip) return 4
  return 5
}
