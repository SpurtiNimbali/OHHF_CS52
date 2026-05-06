/**
 * Cardea mood UI — limited variants (3–5) sharing one visual language.
 * Colors match the pastel reference palette (#A8E6CF, #FFD8A8, #D5AAFF, etc.).
 */

export type MoodId = 'calm' | 'hopeful' | 'uncertain' | 'tired' | 'energized'

export type MoodTheme = {
  /** Tailwind classes for page background (use with bg-gradient-to-br) */
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

/** When no mood is chosen — rainbow gradient from reference default */
export const DEFAULT_MOOD_THEME: MoodTheme = {
  pageBg: 'from-blue-50/30 via-purple-50/30 to-pink-50/30',
  heartFill: '#A8E6CF',
  heartStroke: '#2d5f4f',
  borderGradient: 'linear-gradient(to right, #A8E6CF, #A8C5E6, #D5AAFF) 1',
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
      borderGradient: 'linear-gradient(to right, #A8E6CF, #7dd3ae, #5ec99d) 1',
      reminderBg: 'bg-gradient-to-br from-[#A8E6CF]/20 via-[#7dd3ae]/20 to-[#5ec99d]/20 border-2 border-white',
    },
  },
  {
    id: 'hopeful',
    label: 'Hopeful',
    chipBg: 'bg-[#FFD8A8]',
    chipText: 'text-[#8B5E3C]',
    theme: {
      pageBg: 'from-orange-50/30 via-amber-50/30 to-yellow-50/30',
      heartFill: '#FFD8A8',
      heartStroke: '#8B5E3C',
      borderGradient: 'linear-gradient(to right, #FFD8A8, #ffc97d, #ffba52) 1',
      reminderBg: 'bg-gradient-to-br from-[#FFD8A8]/20 via-[#ffc97d]/20 to-[#ffba52]/20 border-2 border-white',
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
      borderGradient: 'linear-gradient(to right, #D5AAFF, #c88fff, #bb74ff) 1',
      reminderBg: 'bg-gradient-to-br from-[#D5AAFF]/20 via-[#c88fff]/20 to-[#bb74ff]/20 border-2 border-white',
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
      borderGradient: 'linear-gradient(to right, #A8C5E6, #88b3de, #68a1d6) 1',
      reminderBg: 'bg-gradient-to-br from-[#A8C5E6]/20 via-[#88b3de]/20 to-[#68a1d6]/20 border-2 border-white',
    },
  },
  {
    id: 'energized',
    label: 'Energized',
    chipBg: 'bg-[#FFCBA4]',
    chipText: 'text-[#8B5E3C]',
    theme: {
      pageBg: 'from-orange-50/30 via-amber-50/30 to-orange-100/30',
      heartFill: '#FFCBA4',
      heartStroke: '#8B5E3C',
      borderGradient: 'linear-gradient(to right, #FFCBA4, #ffb885, #ffa566) 1',
      reminderBg: 'bg-gradient-to-br from-[#FFCBA4]/20 via-[#ffb885]/20 to-[#ffa566]/20 border-2 border-white',
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
