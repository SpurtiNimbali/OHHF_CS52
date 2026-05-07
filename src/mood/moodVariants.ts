/**
 * Cardea mood UI — limited variants (3–5) sharing one visual language.
 * Colors match the pastel reference palette (#A8E6CF, #FFD8A8, #D5AAFF, etc.).
 */

export type MoodId = 'calm' | 'hopeful' | 'uncertain' | 'tired' | 'energized'

export type MoodTheme = {
  /** Tailwind gradient stops — use with `bg-gradient-to-br` + `moodShellBackgroundClasses` */
  pageBg: string
  heartFill: string
  heartStroke: string
  /** Full border-image value (gradient + slice), for headers */
  borderGradient: string
  /** Tailwind classes for reminder panel */
  reminderBg: string
}

export type MoodUiVariant = {
  id: MoodId
  /** Short label shown on chips */
  label: string
  /** User-facing cue (selected chip uses reference pastels) */
  chipBg: string
  chipText: string
  theme: MoodTheme
}

/**
 * Classic header border for default + calm — mint, periwinkle, lavender (original palette).
 */
export const DEFAULT_HEADER_BORDER_GRADIENT =
  'linear-gradient(to right, #A8E6CF, #A8C5E6, #D5AAFF) 1'

/** No mood — soft rainbow shell, simple border */
export const DEFAULT_MOOD_THEME: MoodTheme = {
  pageBg: 'from-blue-50/30 via-purple-50/30 to-pink-50/30',
  heartFill: '#A8E6CF',
  heartStroke: '#2d5f4f',
  borderGradient: DEFAULT_HEADER_BORDER_GRADIENT,
  reminderBg: 'bg-gradient-to-br from-[#A8E6CF]/20 via-[#FFD8A8]/20 to-[#D5AAFF]/20 border-2 border-white',
}

export const MOOD_VARIANTS: MoodUiVariant[] = [
  {
    id: 'calm',
    label: 'Calm',
    chipBg: 'bg-[#A8E6CF]',
    chipText: 'text-[#2d5f4f]',
    theme: {
      pageBg: 'from-emerald-50/30 via-green-50/30 to-teal-50/30',
      heartFill: '#A8E6CF',
      heartStroke: '#2d5f4f',
      borderGradient: DEFAULT_HEADER_BORDER_GRADIENT,
      reminderBg:
        'bg-[linear-gradient(130deg,rgba(190,232,216,0.2)_0%,rgba(198,236,224,0.17)_28%,rgba(210,242,230,0.18)_52%,rgba(188,234,224,0.16)_76%,rgba(205,238,228,0.19)_100%)] border-2 border-white',
    },
  },
  {
    id: 'hopeful',
    label: 'Hopeful',
    chipBg: 'bg-[#FFD8A8]',
    chipText: 'text-[#8B5E3C]',
    theme: {
      pageBg: 'from-orange-50/30 via-pink-50/30 to-amber-50/30',
      heartFill: '#FFD8A8',
      heartStroke: '#8B5E3C',
      borderGradient:
        'linear-gradient(to right, #FFD8B8, #FFD0E4, #FFE8C8, #FFF4E0) 1',
      reminderBg:
        'bg-[linear-gradient(130deg,rgba(255,222,196,0.2)_0%,rgba(255,228,220,0.18)_26%,rgba(255,236,230,0.19)_52%,rgba(255,232,218,0.17)_78%,rgba(255,242,234,0.2)_100%)] border-2 border-white',
    },
  },
  {
    id: 'uncertain',
    label: 'Uncertain',
    chipBg: 'bg-[#D5AAFF]',
    chipText: 'text-[#5B3A70]',
    theme: {
      pageBg: 'from-purple-50/30 via-violet-50/30 to-fuchsia-50/30',
      heartFill: '#D5AAFF',
      heartStroke: '#5B3A70',
      borderGradient:
        'linear-gradient(to right, #E0C8F8, #D8D0FF, #D0DCFA, #D4E8FC) 1',
      reminderBg:
        'bg-[linear-gradient(130deg,rgba(224,200,248,0.2)_0%,rgba(220,210,255,0.18)_25%,rgba(228,220,252,0.19)_50%,rgba(212,224,252,0.17)_75%,rgba(220,232,255,0.2)_100%)] border-2 border-white',
    },
  },
  {
    id: 'tired',
    label: 'Tired',
    chipBg: 'bg-[#A8C5E6]',
    chipText: 'text-[#2d4f6f]',
    theme: {
      pageBg: 'from-blue-50/30 via-sky-50/30 to-cyan-50/30',
      heartFill: '#A8C5E6',
      heartStroke: '#2d4f6f',
      borderGradient:
        'linear-gradient(to right, #B0D4EC, #B8D0F0, #C4E4F4, #D4EEF8) 1',
      reminderBg:
        'bg-[linear-gradient(130deg,rgba(180,216,236,0.2)_0%,rgba(190,214,240,0.18)_24%,rgba(200,228,244,0.19)_48%,rgba(184,222,238,0.17)_72%,rgba(210,234,248,0.2)_100%)] border-2 border-white',
    },
  },
  {
    id: 'energized',
    label: 'Energized',
    chipBg: 'bg-[#FFCBA4]',
    chipText: 'text-[#8B5E3C]',
    theme: {
      pageBg: 'from-orange-50/30 via-amber-50/30 to-yellow-50/30',
      heartFill: '#FFCBA4',
      heartStroke: '#8B5E3C',
      borderGradient:
        'linear-gradient(to right, #FFD8B8, #FFE4B8, #FFF0C8, #FFF8E4) 1',
      reminderBg:
        'bg-[linear-gradient(130deg,rgba(255,212,188,0.2)_0%,rgba(255,224,200,0.18)_24%,rgba(255,236,216,0.19)_48%,rgba(255,220,196,0.17)_72%,rgba(255,244,228,0.2)_100%)] border-2 border-white',
    },
  },
]

const VARIANT_BY_ID = Object.fromEntries(MOOD_VARIANTS.map((v) => [v.id, v])) as Record<MoodId, MoodUiVariant>

export function moodVariantById(id: MoodId): MoodUiVariant {
  return VARIANT_BY_ID[id] ?? MOOD_VARIANTS[0]
}

export function resolvedMoodTheme(moodId: MoodId | null): MoodTheme {
  return moodId ? moodVariantById(moodId).theme : DEFAULT_MOOD_THEME
}

/** Page shell background — always Tailwind `bg-gradient-to-br` + stops (default + moods). */
export function moodShellBackgroundClasses(_moodId: MoodId | null, pageBg: string): string {
  return `bg-gradient-to-br ${pageBg}`
}

/** Hex `#rrggbb` → `rgba(r,g,b,a)` for inline styles */
export function moodColorWithAlpha(hex: string, alpha: number): string {
  const n = hex.replace('#', '').trim()
  if (n.length !== 6 || !/^[0-9a-fA-F]+$/.test(n)) return `rgba(25, 43, 63, ${alpha})`
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
