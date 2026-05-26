import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpen,
  Brain,
  ChevronRight,
  Coffee,
  Ear,
  Eye,
  Hand,
  Heart,
  RefreshCw,
  Snowflake,
  Sparkles,
  Tag,
  Wind,
} from 'lucide-react'
import { motion } from 'motion/react'
import {
  MOOD_VARIANTS,
  MoodHeartFill,
  getMoodChatPrefill,
  isWellnessToolId,
  MOOD_WELLNESS_PRIMARY_SECONDARY,
  moodShellBackgroundClasses,
  resolveSuggestedExercisesForMood,
  type MoodId,
  moodLocalDateKey,
  useMood,
} from '../mood'
import {
  clearMoodCheckInSession,
  ensureMoodEntryForChat,
  fetchMoodEntries,
  RECENT_MOOD_CHECKINS_LIMIT,
  insertMoodEntry,
  markMoodCheckInSaved,
  saveMoodCheckInIfNeeded,
  type MoodEntryRow,
} from '../lib/moodEntries'
import {
  fetchJournalEntries,
  insertJournalEntry,
  type JournalEntryRow,
} from '../lib/journalEntries'
import { ensureAuthUserId } from '../lib/supabase'
import {
  CARDEA_ALMOST_WHITE,
  CARDEA_DARK_GREEN,
  CARDEA_FONT_PRIMARY,
  CARDEA_LIGHT_BLUE,
  CARDEA_MUTED,
  CARDEA_NAVY,
} from '../ui/cardeaTokens'
import { ResourcesRightNav } from '../components/ResourcesRightNav'
import { ReframesTool } from '../components/wellness/ReframesTool'
import { SafePlaceTool } from '../components/wellness/SafePlaceTool'
import { fetchMyReframes } from '../lib/userReframes'
import { fetchSafePlaces } from '../lib/safePlaces'
import {
  fetchToolUsage,
  insertToolUsage,
  WELLNESS_DAY_RESET_EVENT,
  type ToolUsageRow,
} from '../lib/toolUsage'
import { WELLNESS_TOOL_REGISTRY, type WellnessToolId } from '../lib/wellnessToolRegistry'

type WellnessEmotion =
  | 'happy'
  | 'calm'
  | 'hopeful'
  | 'overwhelmed'
  | 'exhausted'
  | 'angry'
  | 'scared'
  | 'sad'
  | 'disconnected'
  | 'numb'

type ToolId =
  | WellnessToolId
  | 'mood-check-in'
  | 'crisis-reset'

type MoodLogEntry = {
  id: string
  date: string
  emotion: MoodId
  intensity?: number
  note?: string
}

type Reflection = {
  id: string
  prompt: string
  text: string
  date: string
}

type StoredValue<T> = T | (() => T)

const STORAGE = {
  moods: 'cardea-wellness-mood-log',
  reflections: 'cardea-wellness-parent-reflections',
}

const WELLNESS_EMOTIONS: Array<{
  id: WellnessEmotion
  moodId: MoodId
  label: string
  primary: ToolId
  secondary: ToolId
}> = MOOD_VARIANTS.map((m) => {
  const tools = MOOD_WELLNESS_PRIMARY_SECONDARY[m.id]
  return {
    id: m.id as WellnessEmotion,
    moodId: m.id,
    label: m.label,
    primary: tools.primary as ToolId,
    secondary: tools.secondary as ToolId,
  }
})

const TOOL_META: Record<ToolId, {
  title: string
  short: string
  category: 'Regulate body' | 'Understand' | 'Shift mindset' | 'Connect' | 'Crisis'
  icon: typeof Wind
}> = {
  breathing: {
    title: WELLNESS_TOOL_REGISTRY.breathing.label,
    short: '3 calming patterns',
    category: 'Regulate body',
    icon: Wind,
  },
  grounding: {
    title: WELLNESS_TOOL_REGISTRY.grounding.label,
    short: 'settle into your senses',
    category: 'Regulate body',
    icon: Sparkles,
  },
  'physical-regulation': {
    title: WELLNESS_TOOL_REGISTRY['physical-regulation'].label,
    short: 'cold reset · move it out · body scan',
    category: 'Regulate body',
    icon: Activity,
  },
  'mood-check-in': { title: 'Daily mood check-in', short: 'two questions, one minute', category: 'Understand', icon: Heart },
  'name-it': {
    title: WELLNESS_TOOL_REGISTRY['name-it'].label,
    short: 'pick feeling words',
    category: 'Understand',
    icon: Tag,
  },
  'micro-journal': {
    title: WELLNESS_TOOL_REGISTRY['micro-journal'].label,
    short: 'how are you feeling today?',
    category: 'Understand',
    icon: BookOpen,
  },
  reframes: {
    title: WELLNESS_TOOL_REGISTRY.reframes.label,
    short: 'a kinder thought',
    category: 'Shift mindset',
    icon: RefreshCw,
  },
  'safe-place': {
    title: WELLNESS_TOOL_REGISTRY['safe-place'].label,
    short: '90 seconds of steadiness',
    category: 'Shift mindset',
    icon: Heart,
  },
  'today-nudge': {
    title: WELLNESS_TOOL_REGISTRY['today-nudge'].label,
    short: 'feel closer in one small way',
    category: 'Connect',
    icon: Heart,
  },
  'crisis-reset': { title: 'I need help right now', short: 'a guided reset and resources', category: 'Crisis', icon: AlertCircle },
}

const nudges = [
  'tell your child one thing you love about them today.',
  'sit close. no phone. just two minutes.',
  'take 5 minutes with no medical talk.',
  'notice one thing that made them smile.',
  'laugh about something silly together.',
  'you are allowed to enjoy them.',
]

const reflectionPrompts = [
  'when did we last do something fun?',
  'what does connection look like for us right now?',
  'what small joy can we create today?',
]

/** Stored in journal_entries.prompt for standard micro-journal saves (not shown in history UI). */
const MICRO_JOURNAL_STORED_PROMPT =
  "Write down how you're feeling today. Use your own words — there's no right format."

function isStandardMicroJournalPrompt(prompt: string) {
  return (
    prompt === MICRO_JOURNAL_STORED_PROMPT ||
    prompt === 'How are you feeling today?' ||
    prompt === 'Write down your feelings'
  )
}

const emotionFamilies: Record<string, string[]> = {
  joy: ['happy', 'grateful', 'proud', 'playful', 'relieved'],
  calm: ['peaceful', 'settled', 'steady', 'safe', 'grounded'],
  hope: ['hopeful', 'encouraged', 'curious', 'open', 'trusting'],
  neutral: ['okay', 'unsure', 'blank', 'quiet', 'in between'],
  fear: ['scared', 'panicked', 'dreading', 'helpless'],
  exhaustion: ['drained', 'foggy', 'depleted', 'numb'],
  sadness: ['grief', 'lonely', 'heavy', 'hopeless'],
  anger: ['frustrated', 'resentful', 'powerless', 'overwhelmed'],
  connection: ['distant', 'checked out', 'alone', 'unseen'],
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function formatCheckInDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'recently'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatEntryDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'recently'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function readStored<T>(key: string, initialValue: StoredValue<T>): T {
  const fallback = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function useLocalState<T>(key: string, initialValue: StoredValue<T>) {
  const [value, setValue] = useState<T>(() => readStored(key, initialValue))

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore */
    }
  }, [key, value])

  return [value, setValue] as const
}

function moodVariantFor(id: MoodId) {
  return MOOD_VARIANTS.find((m) => m.id === id) ?? MOOD_VARIANTS[0]
}

/** Recent check-ins bar only — Unsure uses neutral chip gray, not mint heart fill. */
function recentCheckInColor(moodId: MoodId): string {
  if (moodId === 'numb') return '#D4DCE8'
  return moodVariantFor(moodId).theme.heartFill
}

function MoodCheckInColorLegend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2" role="list" aria-label="Mood colors">
      {WELLNESS_EMOTIONS.map((emotion) => (
        <div key={emotion.id} className="flex items-center gap-1.5" role="listitem">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-[rgba(25,43,63,0.08)]"
            style={{ background: recentCheckInColor(emotion.moodId) }}
            aria-hidden
          />
          <span className="text-xs" style={{ color: CARDEA_MUTED }}>
            {emotion.label}
          </span>
        </div>
      ))}
    </div>
  )
}

function toolUseCount(usage: ToolUsageRow[], toolId: ToolId, wellnessDayKey: string) {
  return usage.filter((entry) => {
    const usedAt = new Date(entry.timestamp)
    if (Number.isNaN(usedAt.getTime()) || moodLocalDateKey(usedAt) !== wellnessDayKey) return false
    return entry.tool_id === toolId
  }).length
}

function WellnessChip({
  emotion,
  selected,
  onClick,
}: {
  emotion: (typeof WELLNESS_EMOTIONS)[number]
  selected: boolean
  onClick: () => void
}) {
  const mood = moodVariantFor(emotion.moodId)
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
        selected ? `${mood.chipBg} ${mood.chipText} border-transparent shadow-sm` : 'border-white bg-white text-[#3A525A]'
      }`}
      style={{ fontFamily: CARDEA_FONT_PRIMARY }}
    >
      {emotion.label}
    </motion.button>
  )
}

function ToolTile({
  toolId,
  onOpen,
  count,
  accent = CARDEA_LIGHT_BLUE,
}: {
  toolId: ToolId
  onOpen: (toolId: ToolId) => void
  count?: number
  accent?: string
}) {
  const meta = TOOL_META[toolId]
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={() => onOpen(toolId)}
      className="group flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: 'rgba(25, 43, 63, 0.08)' }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: accent }}
      >
        <Icon className="h-5 w-5" style={{ color: CARDEA_NAVY }} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#062A4A]">{meta.title}</span>
        <span className="mt-1 block text-xs leading-relaxed" style={{ color: CARDEA_MUTED }}>
          {meta.short}
        </span>
      </span>
      {count ? (
        <span className="rounded-full bg-[#f5f9f9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#577568]">
          used
        </span>
      ) : null}
      <ChevronRight className="h-5 w-5 text-[#acb7a8]" aria-hidden />
    </button>
  )
}

type RegulateTone = 'forest' | 'sky' | 'outline' | 'sage'

const SUGGESTED_CARD_TONES: Record<
  RegulateTone,
  { bg: string; text: string; muted: string; border: string; icon: string }
> = {
  forest: {
    bg: CARDEA_DARK_GREEN,
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.72)',
    border: 'transparent',
    icon: '#ffffff',
  },
  sky: {
    bg: CARDEA_LIGHT_BLUE,
    text: CARDEA_NAVY,
    muted: 'rgba(25,43,63,0.62)',
    border: 'transparent',
    icon: CARDEA_NAVY,
  },
  outline: {
    bg: '#ffffff',
    text: CARDEA_NAVY,
    muted: 'rgba(25,43,63,0.62)',
    border: CARDEA_NAVY,
    icon: CARDEA_NAVY,
  },
  sage: {
    bg: CARDEA_MUTED,
    text: CARDEA_NAVY,
    muted: 'rgba(25,43,63,0.62)',
    border: 'transparent',
    icon: CARDEA_NAVY,
  },
}

const SUGGESTED_TONES: RegulateTone[] = ['forest', 'sky', 'outline', 'sage']

function SuggestedExerciseCard({
  toolId,
  tone,
  onOpen,
}: {
  toolId: ToolId
  tone: RegulateTone
  onOpen: (toolId: ToolId) => void
}) {
  const meta = TOOL_META[toolId]
  const Icon = meta.icon
  const colors = SUGGESTED_CARD_TONES[tone]

  return (
    <button
      type="button"
      onClick={() => onOpen(toolId)}
      className="group min-h-[146px] rounded-2xl p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        color: colors.text,
      }}
    >
      <Icon className="mb-5 h-6 w-6 transition-transform group-hover:scale-105" style={{ color: colors.icon }} aria-hidden />
      <div className="text-lg font-semibold leading-snug">{meta.title}</div>
      <div className="mt-2 text-sm leading-relaxed" style={{ color: colors.muted }}>
        {meta.short}
      </div>
    </button>
  )
}

function Section({
  id,
  label,
  children,
}: {
  id?: string
  label: string
  children: ReactNode
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-8">
      <div className="mb-5 flex items-center gap-3">
        <h2
          className="text-sm font-bold uppercase tracking-[0.22em]"
          style={{ color: CARDEA_NAVY }}
        >
          {label}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-[#c6d9e5] to-transparent" />
      </div>
      {children}
    </section>
  )
}

function ToolActions({
  onDone,
}: {
  onDone: () => void
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: 'rgba(25, 43, 63, 0.08)' }}>
      <button
        type="button"
        onClick={onDone}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
        style={{ background: CARDEA_DARK_GREEN }}
      >
        Done
      </button>
    </div>
  )
}

type BodyRegion = 'head' | 'shoulders' | 'chest' | 'belly' | 'hips' | 'arms' | 'hands' | 'thighs' | 'calves' | 'feet'

function BodySilhouette({ highlighted = [], accentColor = CARDEA_DARK_GREEN }: {
  highlighted?: BodyRegion[]
  accentColor?: string
}) {
  const BASE = '#C8D5E0'
  const f = (r: BodyRegion) => highlighted.includes(r) ? accentColor : BASE
  return (
    <svg viewBox="0 0 80 185" style={{ width: 64, flexShrink: 0 }} aria-hidden>
      <style>{`.bp{transition:fill .4s ease}`}</style>
      <ellipse className="bp" cx="40" cy="15" rx="13" ry="13" fill={f('head')} />
      <rect className="bp" x="37" y="27" width="6" height="8" rx="2" fill={f('head')} />
      <ellipse className="bp" cx="19" cy="42" rx="11" ry="7" fill={f('shoulders')} />
      <ellipse className="bp" cx="61" cy="42" rx="11" ry="7" fill={f('shoulders')} />
      <rect className="bp" x="24" y="36" width="32" height="30" rx="4" fill={f('chest')} />
      <rect className="bp" x="25" y="65" width="30" height="22" rx="4" fill={f('belly')} />
      <path className="bp" d="M25 86 L55 86 L52 102 L28 102 Z" fill={f('hips')} />
      <rect className="bp" x="8" y="36" width="12" height="58" rx="6" fill={f('arms')} />
      <rect className="bp" x="60" y="36" width="12" height="58" rx="6" fill={f('arms')} />
      <ellipse className="bp" cx="14" cy="101" rx="7" ry="8" fill={f('hands')} />
      <ellipse className="bp" cx="66" cy="101" rx="7" ry="8" fill={f('hands')} />
      <rect className="bp" x="25" y="102" width="14" height="34" rx="5" fill={f('thighs')} />
      <rect className="bp" x="41" y="102" width="14" height="34" rx="5" fill={f('thighs')} />
      <rect className="bp" x="25" y="135" width="12" height="28" rx="5" fill={f('calves')} />
      <rect className="bp" x="43" y="135" width="12" height="28" rx="5" fill={f('calves')} />
      <ellipse className="bp" cx="31" cy="167" rx="11" ry="5" fill={f('feet')} />
      <ellipse className="bp" cx="49" cy="167" rx="11" ry="5" fill={f('feet')} />
    </svg>
  )
}

function BreathingTool() {
  const patterns = [
    { id: 'box', label: 'Box 4-4-4-4', phases: [4, 4, 4, 4] as number[], names: ['Breathe in', 'Hold', 'Breathe out', 'Hold'] },
    { id: '478', label: '4-7-8', phases: [4, 7, 8, 0] as number[], names: ['Breathe in', 'Hold', 'Breathe out', ''] },
    { id: 'sigh', label: 'Physiological sigh', phases: [2, 1, 6, 0] as number[], names: ['Breathe in', 'Hold', 'Breathe out', ''] },
  ]
  const [patternIdx, setPatternIdx] = useState(0)
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)

  const pattern = patterns[patternIdx]
  const activePhases = (pattern?.phases ?? []).filter((d) => d > 0)
  const activeNames = (pattern?.names ?? []).filter((_, i) => (pattern?.phases[i] ?? 0) > 0)
  const cycleDuration = activePhases.reduce((a, b) => a + b, 0) || 1
  const tickInCycle = tick % cycleDuration

  let phaseIdx = 0
  let accumulated = 0
  for (let i = 0; i < activePhases.length; i++) {
    const d = activePhases[i] ?? 0
    if (tickInCycle < accumulated + d) { phaseIdx = i; break }
    accumulated += d
  }

  const phaseElapsed = tickInCycle - accumulated
  const phaseDuration = activePhases[phaseIdx] ?? 1
  const remaining = phaseDuration - phaseElapsed
  const cycleCount = Math.floor(tick / cycleDuration)
  const phaseLabel = activeNames[phaseIdx] ?? ''
  const orbScale = phaseLabel === 'Breathe in' ? 1.14 : phaseLabel === 'Breathe out' ? 0.82 : 1.02
  const mm = Math.floor(tick / 60).toString().padStart(2, '0')
  const ss = (tick % 60).toString().padStart(2, '0')
  const heartColor = !running ? '#fda4af'
    : phaseLabel === 'Breathe in' ? '#f472b6'
    : phaseLabel === 'Hold' ? '#a78bfa'
    : '#60a5fa'
  const patternDescriptions = [
    { title: 'Box Breathing', desc: 'Equal 4-count cycles: inhale, hold, exhale, hold. Used by Navy SEALs to reset focus and calm the nervous system under pressure.' },
    { title: '4-7-8 Breathing', desc: 'Longer hold and extended exhale activate your parasympathetic rest response. Great for anxiety, racing thoughts, or winding down for sleep.' },
    { title: 'Physiological Sigh', desc: 'Double inhale + long exhale. Stanford-researched as the fastest known way to reduce acute physiological stress in real time.' },
  ]

  useEffect(() => {
    if (!running) return
    const id = window.setTimeout(() => setTick((t) => t + 1), 1000)
    return () => window.clearTimeout(id)
  }, [running, tick])

  function reset() { setTick(0); setRunning(false) }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {patterns.map((p, i) => (
          <button key={p.id} type="button"
            onClick={() => { setPatternIdx(i); setTick(0); setRunning(false) }}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ background: patternIdx === i ? '#db2777' : CARDEA_ALMOST_WHITE, color: patternIdx === i ? '#fff' : CARDEA_NAVY }}
          >{p.label}</button>
        ))}
      </div>

      {/* Pattern description */}
      <div className="mb-4 rounded-xl p-3" style={{ background: '#FFF0F5' }}>
        <p className="text-xs font-bold mb-0.5" style={{ color: '#db2777' }}>
          {patternDescriptions[patternIdx]?.title}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: CARDEA_NAVY }}>
          {patternDescriptions[patternIdx]?.desc}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 py-2">
        <div className="relative flex h-52 w-52 items-center justify-center">
          {/* Phase-synced ambient glow */}
          <div className="absolute inset-0 rounded-full" style={{
            background: running ? `radial-gradient(circle, ${heartColor}18 0%, transparent 70%)` : undefined,
            boxShadow: running ? `0 0 52px 20px ${heartColor}33` : undefined,
            transition: 'box-shadow 1.2s ease, background 1s ease',
          }} />
          {/* Heart — color transitions with each phase */}
          <Heart
            fill={heartColor}
            strokeWidth={0}
            aria-hidden
            style={{
              width: 130,
              height: 130,
              transform: `scale(${orbScale})`,
              transition: `transform ${phaseDuration}s ease-in-out, fill 0.8s ease`,
              filter: running ? `drop-shadow(0 0 20px ${heartColor}99)` : undefined,
            }}
          />
        </div>

        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: heartColor, transition: 'color 0.8s ease' }}>{phaseLabel}</p>
          <p className="text-5xl font-bold tabular-nums leading-tight" style={{ color: CARDEA_NAVY }}>{remaining}</p>
        </div>

        <div className="flex gap-6 text-xs font-medium" style={{ color: CARDEA_MUTED }}>
          <span>Cycle {cycleCount + 1}</span>
          <span>{mm}:{ss} elapsed</span>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => setRunning((r) => !r)}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: '#db2777' }}>
            {running ? 'Pause' : tick === 0 ? 'Start' : 'Resume'}
          </button>
          <button type="button" onClick={reset}
            className="rounded-xl border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: 'rgba(25,43,63,0.16)', color: CARDEA_NAVY }}>
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

function GroundingTool() {
  const STEPS = [
    { count: 5, sense: 'see', verb: 'you can see', color: '#3B82F6', bg: '#EFF6FF', Icon: Eye },
    { count: 4, sense: 'touch', verb: 'you can touch', color: CARDEA_DARK_GREEN, bg: '#f0fdf4', Icon: Hand },
    { count: 3, sense: 'hear', verb: 'you can hear', color: '#7C3AED', bg: '#f5f3ff', Icon: Ear },
    { count: 2, sense: 'smell', verb: 'you can smell', color: '#D97706', bg: '#fffbeb', Icon: Wind },
    { count: 1, sense: 'taste', verb: 'you can taste', color: '#C2410C', bg: '#fff7ed', Icon: Coffee },
  ]
  const [idx, setIdx] = useState(0)
  const [entries, setEntries] = useState<Record<number, string>>({})
  const [done, setDone] = useState(false)

  const cur = STEPS[idx]
  const accentColor = cur?.color ?? CARDEA_DARK_GREEN
  const accentBg = cur?.bg ?? CARDEA_ALMOST_WHITE
  const CurIcon = cur?.Icon

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-6 text-center" style={{ background: `${CARDEA_DARK_GREEN}12` }}>
          <p className="text-xl font-semibold mb-1" style={{ color: CARDEA_NAVY }}>You're grounded.</p>
          <p className="text-sm" style={{ color: CARDEA_MUTED }}>your body just found the room.</p>
        </div>
        {STEPS.map((s, i) => {
          const SIcon = s.Icon
          return entries[i] ? (
            <div key={i} className="rounded-2xl border bg-white p-4" style={{ borderColor: `${s.color}35` }}>
              <div className="flex items-center gap-2 mb-2">
                <SIcon className="h-4 w-4" style={{ color: s.color }} aria-hidden />
                <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: s.color }}>
                  {s.count} things to {s.sense}
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: CARDEA_NAVY }}>{entries[i]}</p>
            </div>
          ) : null
        })}
        <button type="button"
          onClick={() => { setIdx(0); setEntries({}); setDone(false) }}
          className="rounded-xl border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: CARDEA_DARK_GREEN, color: CARDEA_DARK_GREEN }}>
          Start again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex justify-between text-xs font-medium" style={{ color: CARDEA_MUTED }}>
          <span>Step {idx + 1} of {STEPS.length}</span>
          <span>{cur?.sense ?? ''}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: CARDEA_LIGHT_BLUE }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(idx / STEPS.length) * 100}%`, background: accentColor }} />
        </div>
      </div>

      {cur && CurIcon && (
        <div className="rounded-2xl p-5" style={{ background: accentBg }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{ background: `${accentColor}20` }}>
              <CurIcon className="h-6 w-6" style={{ color: accentColor }} aria-hidden />
            </div>
            <div>
              <span className="text-5xl font-bold leading-none" style={{ color: accentColor }}>{cur.count}</span>
              <p className="text-base font-semibold mt-1" style={{ color: CARDEA_NAVY }}>things {cur.verb}</p>
            </div>
          </div>
          <p className="text-sm mb-3" style={{ color: CARDEA_MUTED }}>name them softly. typing is optional.</p>
          <textarea
            value={entries[idx] ?? ''}
            onChange={(e) => setEntries((prev) => ({ ...prev, [idx]: e.target.value }))}
            placeholder={`What can you ${cur.sense}?`}
            rows={2}
            className="w-full rounded-xl border bg-white p-3 text-sm outline-none resize-none"
            style={{ borderColor: `${accentColor}40`, color: CARDEA_NAVY }}
          />
        </div>
      )}

      <button type="button"
        onClick={() => { if (idx < STEPS.length - 1) setIdx((i) => i + 1); else setDone(true) }}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
        style={{ background: accentColor }}>
        {idx < STEPS.length - 1 ? 'Next →' : 'Complete'}
      </button>
    </div>
  )
}

function ColdResetTool() {
  const STEPS = [
    { label: 'Cold water on face', desc: 'Splash cold water over your face, or briefly submerge.' },
    { label: 'Cold water on wrists', desc: 'Run cold water over the inside of both wrists.' },
    { label: 'Hold ice or cold pack', desc: 'Hold ice wrapped in a cloth against your face or wrists.' },
  ]
  const COLD_STEP_REGIONS: BodyRegion[][] = [
    ['head'],
    ['hands'],
    ['hands'],
  ]
  const DURATION = 60
  const [selectedStep, setSelectedStep] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)
  const remaining = DURATION - tick
  const done = tick >= DURATION
  const progress = tick / DURATION
  const circumference = 2 * Math.PI * 54
  const strokeDashoffset = circumference * (1 - progress)

  useEffect(() => {
    if (!running || tick >= DURATION) return
    const id = window.setTimeout(() => setTick((t) => t + 1), 1000)
    return () => window.clearTimeout(id)
  }, [running, tick])

  function selectStep(i: number) { setSelectedStep(i); setTick(0); setRunning(false) }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
        Cold activates your vagus nerve, slowing your heart rate and calming your stress response within seconds.
      </p>
      <div className="grid gap-3">
        {STEPS.map((s, i) => (
          <button key={i} type="button" onClick={() => selectStep(i)}
            className="rounded-2xl border p-4 text-left transition-all"
            style={{
              borderColor: selectedStep === i ? CARDEA_DARK_GREEN : 'rgba(25,43,63,0.1)',
              background: selectedStep === i ? `${CARDEA_DARK_GREEN}10` : '#fff',
            }}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: selectedStep === i ? '#dbeafe' : CARDEA_ALMOST_WHITE }}>
                <span className="text-xs font-bold" style={{ color: '#2563eb' }}>{i + 1}</span>
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: CARDEA_NAVY }}>{s.label}</p>
                <p className="text-xs mt-0.5" style={{ color: CARDEA_MUTED }}>{s.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedStep !== null && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex items-center gap-6">
            <BodySilhouette
              highlighted={COLD_STEP_REGIONS[selectedStep] ?? []}
              accentColor="#60a5fa"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
                  <circle cx="60" cy="60" r="54" fill="none" stroke={CARDEA_LIGHT_BLUE} strokeWidth="6" opacity={0.35} />
                  <circle cx="60" cy="60" r="54" fill="none"
                    stroke={done ? '#22c55e' : '#60a5fa'} strokeWidth="6"
                    strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 1s linear' }} />
                </svg>
                <div className="text-center">
                  <span className="text-3xl font-bold" style={{ color: CARDEA_NAVY }}>{done ? '✓' : remaining}</span>
                  {!done && <span className="block text-xs" style={{ color: CARDEA_MUTED }}>sec</span>}
                </div>
              </div>
              {done
                ? <p className="text-sm font-semibold" style={{ color: CARDEA_DARK_GREEN }}>Done. Notice how your body feels.</p>
                : <p className="text-xs text-center" style={{ color: CARDEA_MUTED }}>stop if it feels unsafe.</p>
              }
            </div>
          </div>
          <button type="button"
            onClick={() => { if (done) { setTick(0); setRunning(true) } else setRunning((r) => !r) }}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: CARDEA_DARK_GREEN }}>
            {done ? 'Again' : running ? 'Pause' : 'Start'}
          </button>
        </div>
      )}
    </div>
  )
}

function MoveItOutTool() {
  const CUES = [
    { text: 'Shake out your hands', emoji: '🤲' },
    { text: 'Stomp slowly in place', emoji: '🦶' },
    { text: 'Push against a wall', emoji: '🧱' },
    { text: 'Roll your shoulders back', emoji: '🔄' },
  ]
  const DURATION = 60
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)
  const remaining = DURATION - tick
  const done = tick >= DURATION
  const segmentDuration = DURATION / CUES.length
  const cueIdx = Math.min(Math.floor(tick / segmentDuration), CUES.length - 1)
  const currentCue = CUES[cueIdx]

  useEffect(() => {
    if (!running || tick >= DURATION) return
    const id = window.setTimeout(() => setTick((t) => t + 1), 1000)
    return () => window.clearTimeout(id)
  }, [running, tick])

  return (
    <div className="space-y-5 text-center">
      <div className="rounded-2xl p-6" style={{ background: `${CARDEA_DARK_GREEN}10` }}>
        <div className="text-6xl mb-3">{running || done ? (currentCue?.emoji ?? '✓') : '🌿'}</div>
        <p className="text-xl font-semibold" style={{ color: CARDEA_NAVY }}>
          {done ? "That's it. How does your body feel?" : running ? (currentCue?.text ?? '') : 'Ready when you are'}
        </p>
        {running && !done && (
          <p className="text-xs mt-2" style={{ color: CARDEA_MUTED }}>
            next move in {Math.ceil(segmentDuration - (tick % segmentDuration))}s
          </p>
        )}
      </div>
      <div className="text-5xl font-bold tabular-nums" style={{ color: CARDEA_DARK_GREEN }}>
        {done ? '✓' : remaining}
      </div>
      {!done && <p className="text-xs" style={{ color: CARDEA_MUTED }}>seconds left</p>}
      <button type="button"
        onClick={() => { if (done) { setTick(0); setRunning(true) } else setRunning((r) => !r) }}
        className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
        style={{ background: CARDEA_DARK_GREEN }}>
        {done ? 'Again' : running ? 'Pause' : tick === 0 ? 'Start' : 'Resume'}
      </button>
    </div>
  )
}

function BodyScanTool() {
  const STEPS = [
    'Notice your scalp and forehead. Let any tension soften.',
    'Bring attention to your jaw and neck. Unclench gently.',
    'Notice your shoulders. Let them drop away from your ears.',
    'Move to your arms and hands. Uncurl your fingers.',
    'Bring attention to your chest. Let each breath expand it softly.',
    'Notice your belly. Let it rise and fall freely.',
    'Move to your lower back. Soften on each exhale.',
    'Bring attention to your thighs and hips. Let them sink.',
    'Notice your calves and feet. Let them be heavy against the floor.',
  ]
  const STEP_DURATION = 20
  const TOTAL = STEPS.length * STEP_DURATION
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)
  const done = tick >= TOTAL
  const stepIdx = Math.min(Math.floor(tick / STEP_DURATION), STEPS.length - 1)
  const stepElapsed = tick - stepIdx * STEP_DURATION
  const stepRemaining = STEP_DURATION - stepElapsed
  const stepProgress = stepElapsed / STEP_DURATION
  const bodyProgress = ((stepIdx + stepElapsed / STEP_DURATION) / STEPS.length) * 100
  const circumference = 2 * Math.PI * 40
  const strokeDashoffset = circumference * (1 - (done ? 1 : stepProgress))

  useEffect(() => {
    if (!running || tick >= TOTAL) return
    const id = window.setTimeout(() => setTick((t) => t + 1), 1000)
    return () => window.clearTimeout(id)
  }, [running, tick, TOTAL])

  function reset() { setTick(0); setRunning(false) }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1.5 flex justify-between text-xs font-medium" style={{ color: CARDEA_MUTED }}>
          <span>Head</span>
          <span>Feet</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: CARDEA_LIGHT_BLUE }}>
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${done ? 100 : bodyProgress}%`, background: CARDEA_DARK_GREEN }} />
        </div>
        <p className="mt-1 text-xs text-right" style={{ color: CARDEA_MUTED }}>~3 min total</p>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="40" fill="none" stroke={CARDEA_LIGHT_BLUE} strokeWidth="7" opacity={0.4} />
            <circle cx="50" cy="50" r="40" fill="none" stroke={CARDEA_DARK_GREEN} strokeWidth="7"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <div className="text-center">
            <span className="text-xl font-bold" style={{ color: CARDEA_NAVY }}>{done ? '✓' : stepRemaining}</span>
            {!done && <span className="block text-[10px]" style={{ color: CARDEA_MUTED }}>sec</span>}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-1" style={{ color: CARDEA_MUTED }}>
            Step {stepIdx + 1} of {STEPS.length}
          </p>
          <p className="text-base leading-snug font-semibold" style={{ color: CARDEA_NAVY }}>
            {done ? 'Scan complete. Rest here.' : STEPS[stepIdx]}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button"
          onClick={() => { if (done) reset(); else setRunning((r) => !r) }}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: CARDEA_DARK_GREEN }}>
          {done ? 'Start again' : running ? 'Pause' : tick === 0 ? 'Start' : 'Resume'}
        </button>
        {tick > 0 && !done && (
          <button type="button" onClick={reset}
            className="rounded-xl border px-5 py-2.5 text-sm font-semibold"
            style={{ borderColor: 'rgba(25,43,63,0.16)', color: CARDEA_NAVY }}>
            Restart
          </button>
        )}
      </div>
      {running && !done && (
        <p className="text-xs text-center" style={{ color: CARDEA_MUTED }}>
          breathe naturally. each breath softens you a little more.
        </p>
      )}
    </div>
  )
}

function MicroJournalTool({ onEntriesChanged }: { onEntriesChanged?: () => void }) {
  const savePrompt = MICRO_JOURNAL_STORED_PROMPT
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<JournalEntryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const reloadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const rows = await fetchJournalEntries(40)
    setHistory(rows)
    setHistoryLoading(false)
  }, [])

  useEffect(() => {
    void reloadHistory()
  }, [reloadHistory])

  async function handleSave() {
    const trimmed = text.trim()
    if (!trimmed || saving) return
    setSaving(true)
    setSaveError(null)
    const { entry, error } = await insertJournalEntry(savePrompt, trimmed)
    if (error) {
      setSaveError(error)
      setSaving(false)
      return
    }
    setText('')
    setSaved(true)
    if (entry) {
      setHistory((prev) => [entry, ...prev.filter((r) => r.id !== entry.id)].slice(0, 40))
    } else {
      await reloadHistory()
    }
    onEntriesChanged?.()
    window.setTimeout(() => setSaved(false), 1600)
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <p className="text-base leading-relaxed text-[#192b3f]">{MICRO_JOURNAL_STORED_PROMPT}</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Start writing here…"
        rows={6}
        className="w-full resize-y rounded-2xl border bg-[#f5f9f9] px-4 py-3 text-sm leading-relaxed outline-none"
        style={{ borderColor: CARDEA_LIGHT_BLUE, color: CARDEA_NAVY }}
      />

      {saveError ? (
        <p className="text-sm leading-relaxed text-[#9B1C31]">{saveError}</p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {saved ? (
          <span className="text-sm" style={{ color: CARDEA_DARK_GREEN }}>
            saved.
          </span>
        ) : null}
        <button
          type="button"
          disabled={!text.trim() || saving}
          onClick={() => void handleSave()}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: CARDEA_NAVY }}
        >
          Save
        </button>
      </div>

      <div className="border-t pt-5" style={{ borderColor: 'rgba(25,43,63,0.08)' }}>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_MUTED }}>
          history
        </p>
        {historyLoading ? (
          <p className="text-sm" style={{ color: CARDEA_MUTED }}>
            loading…
          </p>
        ) : history.length === 0 ? (
          <p className="text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
            No entries yet. What you save will show up here.
          </p>
        ) : (
          <ul className="space-y-4">
            {history.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border bg-[#f5f9f9] px-4 py-3"
                style={{ borderColor: 'rgba(25,43,63,0.08)' }}
              >
                <p className="text-xs" style={{ color: CARDEA_MUTED }}>
                  {formatEntryDateTime(row.timestamp)}
                </p>
                {row.prompt && !isStandardMicroJournalPrompt(row.prompt) ? (
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
                    {row.prompt}
                  </p>
                ) : null}
                <p
                  className={`whitespace-pre-wrap text-sm leading-relaxed text-[#3A525A] ${
                    row.prompt && !isStandardMicroJournalPrompt(row.prompt) ? 'mt-2' : 'mt-1'
                  }`}
                >
                  {row.entry}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const NAME_IT_MAX_WORDS = 10

function NameItTool({ onOpenTool }: { onOpenTool: (toolId: ToolId) => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (word: string) => {
    setSelected((cur) =>
      cur.includes(word)
        ? cur.filter((w) => w !== word)
        : cur.length >= NAME_IT_MAX_WORDS
          ? cur
          : [...cur, word],
    )
  }
  const recommendation: ToolId =
    selected.some((w) => ['scared', 'panicked', 'dreading', 'helpless'].includes(w))
      ? 'safe-place'
      : selected.some((w) => ['frustrated', 'resentful', 'powerless', 'overwhelmed'].includes(w))
        ? 'reframes'
        : selected.some((w) => ['drained', 'foggy', 'depleted', 'numb'].includes(w))
          ? 'physical-regulation'
          : 'micro-journal'

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: CARDEA_MUTED }}>
        pick up to {NAME_IT_MAX_WORDS} words. naming softens them.
      </p>
      {Object.entries(emotionFamilies).map(([family, words]) => (
        <div key={family}>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_MUTED }}>{family}</p>
          <div className="flex flex-wrap gap-2">
            {words.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => toggle(word)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  selected.includes(word) ? 'text-white' : 'bg-[#f5f9f9] text-[#192b3f]'
                }`}
                style={{ background: selected.includes(word) ? CARDEA_NAVY : undefined }}
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      ))}
      {selected.length > 0 ? (
        <div className="rounded-2xl bg-[#577568]/10 p-4">
          <p className="text-sm leading-relaxed text-[#192b3f]">
            you named <strong>{selected.join(', ')}</strong>. try this next.
          </p>
          <button
            type="button"
            onClick={() => onOpenTool(recommendation)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: CARDEA_DARK_GREEN }}
          >
            {TOOL_META[recommendation].title}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function PastEntriesSection({
  moodEntries,
  journalRefreshKey = 0,
}: {
  moodEntries: MoodEntryRow[]
  journalRefreshKey?: number
}) {
  const [journalRows, setJournalRows] = useState<JournalEntryRow[]>([])
  const [reflections] = useLocalState<Reflection[]>(STORAGE.reflections, [])
  const [userReframes, setUserReframes] = useState<Awaited<ReturnType<typeof fetchMyReframes>>>([])
  const [safePlaces, setSafePlaces] = useState<Awaited<ReturnType<typeof fetchSafePlaces>>>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [rows, reframes, places] = await Promise.all([
        fetchJournalEntries(50),
        fetchMyReframes(50),
        fetchSafePlaces(50),
      ])
      if (!cancelled) {
        setJournalRows(rows)
        setUserReframes(reframes)
        setSafePlaces(places)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [journalRefreshKey])

  const entries = useMemo(() => {
    const moodItems = moodEntries.map((row) => {
      const mood = moodVariantFor(row.mood)
      const emotion = WELLNESS_EMOTIONS.find((item) => item.moodId === row.mood)
      return {
        id: row.id,
        date: row.timestamp,
        type: 'Mood check-in',
        prompt: '',
        text: emotion?.label ?? mood.label,
      }
    })

    const journals = journalRows.map((row) => ({
      id: row.id,
      date: row.timestamp,
      type: 'Micro-journal',
      prompt: isStandardMicroJournalPrompt(row.prompt) ? '' : row.prompt,
      text: row.entry,
    }))

    const parentReflections = reflections.map((entry) => ({
      id: entry.id,
      date: entry.date,
      type: 'Parent reflection',
      prompt: entry.prompt,
      text: entry.text,
    }))

    const savedReframes = userReframes.map((entry) => ({
      id: entry.id,
      date: entry.timestamp,
      type: 'Reframe',
      prompt: entry.thought,
      text: entry.reframe,
    }))

    const safePlaceEntries = safePlaces.map((place) => ({
      id: place.id,
      date: place.timestamp,
      type: 'Safe place',
      prompt: place.name,
      text: place.description,
    }))

    return [
      ...moodItems,
      ...journals,
      ...parentReflections,
      ...savedReframes,
      ...safePlaceEntries,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [journalRows, moodEntries, userReframes, reflections, safePlaces])

  return (
    <div className="rounded-3xl bg-white/85 p-5 shadow-sm">
      {entries.length === 0 ? (
        <p className="text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
          No saved entries yet. Your check-in notes, journal entries, reframes, and reflections will show here.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <article
              key={`${entry.type}-${entry.id}`}
              className="rounded-2xl border bg-[#f5f9f9] p-4"
              style={{ borderColor: 'rgba(25,43,63,0.08)' }}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: CARDEA_DARK_GREEN }}
                >
                  {entry.type}
                </span>
                <span className="text-xs" style={{ color: CARDEA_MUTED }}>
                  {formatEntryDateTime(entry.date)}
                </span>
              </div>
              {entry.prompt ? (
                <p className="text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
                  {entry.prompt}
                </p>
              ) : null}
              {entry.text ? (
                <p className={`whitespace-pre-wrap text-sm leading-relaxed text-[#3A525A] ${entry.prompt ? 'mt-2' : ''}`}>
                  {entry.text}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function TodayNudgeCard() {
  const [idx, setIdx] = useState(() => new Date().getDate() % nudges.length)
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 text-white"
      style={{ background: `linear-gradient(135deg, ${CARDEA_NAVY}, #2c4566 62%, ${CARDEA_DARK_GREEN})` }}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
          <Heart className="h-5 w-5 text-[#c6d9e5]" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c6d9e5]/80">today&apos;s nudge</p>
          <h3 className="text-xl font-semibold text-white">a small invitation</h3>
        </div>
        <button
          type="button"
          onClick={() => setIdx((i) => (i + 1) % nudges.length)}
          className="ml-auto text-xs font-semibold text-[#c6d9e5]"
        >
          another
        </button>
      </div>
      <p className="text-lg leading-relaxed text-[#c6d9e5]">{nudges[idx]}</p>
    </div>
  )
}

function ReflectionPromptsPanel({ onJournal }: { onJournal: () => void }) {
  const [reflections, setReflections] = useLocalState<Reflection[]>(STORAGE.reflections, [])
  const [openPrompt, setOpenPrompt] = useState<string | null>(null)
  const [text, setText] = useState('')
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {reflectionPrompts.map((prompt) => (
        <div
          key={prompt}
          className="rounded-2xl border bg-white p-4 shadow-sm"
          style={{ borderColor: CARDEA_LIGHT_BLUE }}
        >
          <p className="mb-3 text-sm font-semibold text-[#192b3f]">{prompt}</p>
          {openPrompt === prompt ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[90px] w-full rounded-xl border bg-[#f5f9f9] p-3 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  if (!text.trim()) return
                  setReflections([
                    { id: makeId('reflection'), prompt, text: text.trim(), date: new Date().toISOString() },
                    ...reflections,
                  ])
                  setText('')
                  setOpenPrompt(null)
                }}
                className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: CARDEA_DARK_GREEN }}
              >
                Save
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setOpenPrompt(prompt)}
              className="text-xs font-semibold"
              style={{ color: CARDEA_DARK_GREEN }}
            >
              Reflect →
            </button>
          )}
          <button type="button" onClick={onJournal} className="ml-3 text-xs font-semibold" style={{ color: CARDEA_MUTED }}>
            journal
          </button>
        </div>
      ))}
    </div>
  )
}

function TodayNudgeTool({ onJournal }: { onJournal: () => void }) {
  return (
    <div className="space-y-4">
      <TodayNudgeCard />
      <ReflectionPromptsPanel onJournal={onJournal} />
    </div>
  )
}

function CrisisResetTool() {
  const steps = [
    'put both feet on the floor.',
    'look for one safe object nearby.',
    'take one longer exhale.',
    'text or call someone now.',
  ]
  const [idx, setIdx] = useState(0)
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-[#fff7f7] p-5" style={{ borderColor: 'rgba(220, 38, 38, 0.18)' }}>
        <p className="text-lg font-semibold text-[#9B1C31]">{steps[idx]}</p>
        <button
          type="button"
          onClick={() => setIdx((i) => Math.min(i + 1, steps.length - 1))}
          className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ background: '#9B1C31' }}
        >
          {idx >= steps.length - 1 ? 'Stay with this' : 'Next'}
        </button>
      </div>
      <div className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-[#192b3f]">
        if you might hurt yourself or someone else, call <strong>988</strong> in the U.S.
        or go to the nearest emergency room.
      </div>
    </div>
  )
}

function PhysicalRegulationTool() {
  const TABS = [
    { id: 'cold' as const, label: 'Cold Reset', Icon: Snowflake },
    { id: 'move' as const, label: 'Move It Out', Icon: Activity },
    { id: 'scan' as const, label: 'Body Scan', Icon: Brain },
  ]
  type TabId = 'cold' | 'move' | 'scan'
  const [activeTab, setActiveTab] = useState<TabId>('cold')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-2xl p-1" style={{ background: CARDEA_ALMOST_WHITE }}>
        {TABS.map((tab) => {
          const TabIcon = tab.Icon
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition-all"
              style={{
                background: isActive ? '#fff' : 'transparent',
                color: isActive ? CARDEA_NAVY : CARDEA_MUTED,
                boxShadow: isActive ? '0 1px 4px rgba(25,43,63,0.08)' : undefined,
              }}
            >
              <TabIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {tab.label}
            </button>
          )
        })}
      </div>
      {activeTab === 'cold' && <ColdResetTool />}
      {activeTab === 'move' && <MoveItOutTool />}
      {activeTab === 'scan' && <BodyScanTool />}
    </div>
  )
}

function ToolContent({
  toolId,
  onOpenTool,
  onMoodEntriesChanged,
  onJournalEntriesChanged,
}: {
  toolId: ToolId
  onOpenTool: (toolId: ToolId) => void
  onMoodEntriesChanged?: () => void
  onJournalEntriesChanged?: () => void
}) {
  if (toolId === 'breathing') return <BreathingTool />
  if (toolId === 'grounding') return <GroundingTool />
  if (toolId === 'physical-regulation') return <PhysicalRegulationTool />
  if (toolId === 'mood-check-in') return <MoodCheckInTool onSaved={onMoodEntriesChanged} />
  if (toolId === 'name-it') return <NameItTool onOpenTool={onOpenTool} />
  if (toolId === 'micro-journal') {
    return <MicroJournalTool onEntriesChanged={onJournalEntriesChanged} />
  }
  if (toolId === 'reframes') return <ReframesTool />
  if (toolId === 'safe-place') return <SafePlaceTool />
  if (toolId === 'today-nudge') return <TodayNudgeTool onJournal={() => onOpenTool('micro-journal')} />
  return <CrisisResetTool />
}

function MoodCheckInTool({ onSaved }: { onSaved?: () => void }) {
  const [mood, setMood] = useState<WellnessEmotion | null>(null)
  const [underneath, setUnderneath] = useState('')
  const [history, setHistory] = useLocalState<MoodLogEntry[]>(STORAGE.moods, [])
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {WELLNESS_EMOTIONS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setMood(e.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${mood === e.id ? 'text-white' : 'bg-[#f5f9f9]'}`}
            style={{ background: mood === e.id ? CARDEA_NAVY : undefined, color: mood === e.id ? '#fff' : CARDEA_NAVY }}
          >
            {e.label}
          </button>
        ))}
      </div>
      <input
        value={underneath}
        onChange={(e) => setUnderneath(e.target.value)}
        placeholder="what's underneath it?"
        className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none"
        style={{ borderColor: CARDEA_LIGHT_BLUE }}
      />
      <button
        type="button"
        disabled={!mood}
        onClick={() => {
          if (!mood) return
          const meta = WELLNESS_EMOTIONS.find((e) => e.id === mood)
          const moodId = meta?.moodId ?? mood
          setHistory([
            {
              id: makeId('mood'),
              date: new Date().toISOString(),
              emotion: moodId,
              note: underneath.trim() || undefined,
            },
            ...history,
          ].slice(0, 80))
          setSaveError(null)
          void insertMoodEntry(moodId).then(({ entry, error }) => {
            if (error) {
              setSaveError(error)
              return
            }
            if (entry) onSaved?.()
            setUnderneath('')
            setSaved(true)
            window.setTimeout(() => setSaved(false), 1600)
          })
        }}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: CARDEA_DARK_GREEN }}
      >
        Save check-in
      </button>
      {saveError ? <p className="text-sm text-[#9B1C31]">{saveError}</p> : null}
      {saved ? <p className="text-sm" style={{ color: CARDEA_DARK_GREEN }}>saved.</p> : null}
    </div>
  )
}

export default function WellnessTools() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { moodId, setMoodId, theme, wellnessDayKey } = useMood()
  const [selectedEmotion, setSelectedEmotion] = useState<WellnessEmotion | null>(() =>
    moodId ? (moodId as WellnessEmotion) : null,
  )
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)
  const [moodLog, setMoodLog] = useLocalState<MoodLogEntry[]>(STORAGE.moods, [])
  const [moodEntries, setMoodEntries] = useState<MoodEntryRow[]>([])
  const [toolUsage, setToolUsage] = useState<ToolUsageRow[]>([])
  const [checkInSaved, setCheckInSaved] = useState(false)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [journalRefreshKey, setJournalRefreshKey] = useState(0)

  const reloadMoodEntries = useCallback(async () => {
    const rows = await fetchMoodEntries(RECENT_MOOD_CHECKINS_LIMIT)
    setMoodEntries(rows)
  }, [])

  const reloadToolUsage = useCallback(async () => {
    const rows = await fetchToolUsage(200)
    setToolUsage(rows)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await ensureAuthUserId()
      if (cancelled) return
      await Promise.all([reloadMoodEntries(), reloadToolUsage()])
    })()
    return () => {
      cancelled = true
    }
  }, [reloadMoodEntries, reloadToolUsage])

  useEffect(() => {
    void reloadToolUsage()
  }, [wellnessDayKey, reloadToolUsage])

  useEffect(() => {
    const onWellnessDayReset = () => {
      setToolUsage([])
      void reloadToolUsage()
    }
    window.addEventListener(WELLNESS_DAY_RESET_EVENT, onWellnessDayReset)
    return () => window.removeEventListener(WELLNESS_DAY_RESET_EVENT, onWellnessDayReset)
  }, [reloadToolUsage])

  useEffect(() => {
    const pending = sessionStorage.getItem('cardea-wellness-pending-journal-prompt')
    if (pending) {
      sessionStorage.removeItem('cardea-wellness-pending-journal-prompt')
      setActiveTool('micro-journal')
    }
  }, [])

  useEffect(() => {
    if (moodId) setSelectedEmotion(moodId as WellnessEmotion)
  }, [moodId])

  useEffect(() => {
    const tool = searchParams.get('tool')
    if (tool && isWellnessToolId(tool)) setActiveTool(tool)
  }, [searchParams])

  const selectedMeta = selectedEmotion ? WELLNESS_EMOTIONS.find((e) => e.id === selectedEmotion) ?? null : null
  const suggestedExercises = useMemo(
    () => resolveSuggestedExercisesForMood(selectedEmotion ?? moodId) as ToolId[],
    [moodId, selectedEmotion],
  )
  const recentMoods = useMemo(() => {
    if (moodEntries.length > 0) {
      return [...moodEntries]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((row) => ({
          id: row.id,
          date: row.timestamp,
          emotion: row.mood,
        }))
    }
    return moodLog.slice(0, RECENT_MOOD_CHECKINS_LIMIT).reverse()
  }, [moodEntries, moodLog])
  const recentMoodSummaries = useMemo(
    () =>
      recentMoods.map((entry) => {
        const mood = moodVariantFor(entry.emotion)
        const emotion = WELLNESS_EMOTIONS.find((item) => item.moodId === entry.emotion)
        return {
          ...entry,
          label: emotion?.label ?? mood.label,
          color: recentCheckInColor(entry.emotion),
          dateTime: formatCheckInDateTime(entry.date),
        }
      }),
    [recentMoods],
  )
  const recentMoodGradient = useMemo(() => {
    const colors = recentMoodSummaries.map((entry) => entry.color)
    return `linear-gradient(90deg, ${colors.join(', ')})`
  }, [recentMoodSummaries])

  async function saveCheckInFromSelection(options?: { showSavedToast?: boolean }): Promise<boolean> {
    if (!selectedMeta) return true
    setCheckInError(null)
    setMoodLog([
      {
        id: makeId('mood'),
        date: new Date().toISOString(),
        emotion: selectedMeta.moodId,
      },
      ...moodLog,
    ].slice(0, 80))
    const { entry, error, alreadySaved } = await saveMoodCheckInIfNeeded(selectedMeta.moodId)
    if (error) {
      setCheckInError(error)
      return false
    }
    if (entry) {
      markMoodCheckInSaved(selectedMeta.moodId, entry.id)
      setMoodEntries((prev) =>
        [entry, ...prev.filter((r) => r.id !== entry.id)].slice(0, RECENT_MOOD_CHECKINS_LIMIT),
      )
      if (options?.showSavedToast && !alreadySaved) {
        setCheckInSaved(true)
        window.setTimeout(() => setCheckInSaved(false), 1800)
      }
    } else {
      await reloadMoodEntries()
    }
    return true
  }

  async function saveMoodCheckIn() {
    await saveCheckInFromSelection({ showSavedToast: true })
  }

  async function openMoodChat() {
    if (!selectedMeta) return
    setCheckInError(null)
    setMoodLog([
      {
        id: makeId('mood'),
        date: new Date().toISOString(),
        emotion: selectedMeta.moodId,
      },
      ...moodLog,
    ].slice(0, 80))
    const { entry, entryId: moodEntryId, error } = await ensureMoodEntryForChat(selectedMeta.moodId)
    if (error) {
      setCheckInError(error)
      return
    }
    if (entry) {
      markMoodCheckInSaved(selectedMeta.moodId, entry.id)
      setMoodEntries((prev) =>
        [entry, ...prev.filter((r) => r.id !== entry.id)].slice(0, RECENT_MOOD_CHECKINS_LIMIT),
      )
    } else {
      await reloadMoodEntries()
    }
    navigate('/chat', {
      state: {
        prefill: getMoodChatPrefill(selectedMeta.moodId),
        moodId: selectedMeta.moodId,
        moodEntryId,
      },
    })
  }

  async function openTool(toolId: ToolId, options?: { saveCheckIn?: boolean }) {
    if (options?.saveCheckIn && selectedMeta) {
      const ok = await saveCheckInFromSelection({ showSavedToast: true })
      if (!ok) return
    }
    setActiveTool(toolId)
    const { row } = await insertToolUsage(toolId)
    if (row) {
      setToolUsage((prev) => [row, ...prev.filter((r) => r.id !== row.id)])
    } else {
      void reloadToolUsage()
    }
  }

  function chooseEmotion(emotion: (typeof WELLNESS_EMOTIONS)[number]) {
    setMoodId(emotion.moodId)
    setCheckInSaved(false)
    setCheckInError(null)
    clearMoodCheckInSession()
    setActiveTool(null)
  }

  const activeMeta = activeTool ? TOOL_META[activeTool] : null

  return (
    <div
      className={`flex min-h-screen transition-all duration-700 ${moodShellBackgroundClasses(moodId, theme.pageBg)}`}
      style={{ fontFamily: CARDEA_FONT_PRIMARY, color: CARDEA_NAVY }}
    >
      <div className="min-w-0 flex-1">
      <header
        className="border-b-4 border-transparent bg-white px-5 py-5 shadow-sm sm:px-8"
        style={{ borderImage: theme.borderGradient }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="rounded-full border border-[rgba(25,43,63,0.12)] bg-white px-4 py-2 text-sm font-semibold text-[#192b3f]"
          >
            ← Home
          </button>
          <button
            type="button"
            onClick={() => openTool('crisis-reset')}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white"
            style={{ background: '#9B1C31' }}
          >
            I need help right now
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-5 py-8 pb-24 sm:px-8 lg:px-10">
        <section
          id="top"
          className="relative overflow-hidden rounded-3xl p-8 text-white shadow-[0_18px_50px_-28px_rgba(25,43,63,0.55)] sm:p-10"
          style={{
            background: `linear-gradient(135deg, ${CARDEA_NAVY} 0%, #2c4566 62%, ${CARDEA_DARK_GREEN} 100%)`,
          }}
        >
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#c6d9e5]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-[#577568]/30 blur-3xl" />
          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#acb7a8]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#c6d9e5]">
                tools · you&apos;re safe here
              </span>
            </div>
            <h1
              className="mb-3 text-[2.75rem] leading-none text-white sm:text-[3.5rem]"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}
            >
              hello, <span className="text-[#c6d9e5]">how are you today?</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[#c6d9e5]/90 sm:text-lg">
              Whatever you&apos;re carrying right now, you don&apos;t have to put it down all at once.
            </p>
          </div>
        </section>

        <Section id="understand" label="Understand what you're feeling">
          <div className="rounded-3xl bg-white/85 p-6 shadow-sm backdrop-blur">
            <div className="mb-5 flex items-center gap-4">
              <MoodHeartFill
                theme={theme}
                size={48}
                viewBox="0 0 100 100"
                pathD="M50 85C50 85 20 65 20 40C20 25 30 15 40 15C45 15 50 20 50 20C50 20 55 15 60 15C70 15 80 25 80 40C80 65 50 85 50 85Z"
                stroke={theme.heartStroke}
                strokeWidth={2}
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: CARDEA_MUTED }}>
                  daily mood check-in
                </p>
                <h3 className="text-3xl text-[#062A4A]" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.07em' }}>
                  how are you?
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {WELLNESS_EMOTIONS.map((emotion) => (
                <WellnessChip
                  key={emotion.id}
                  emotion={emotion}
                  selected={moodId === emotion.moodId}
                  onClick={() => chooseEmotion(emotion)}
                />
              ))}
            </div>

            <p className="mt-2 text-xs leading-relaxed" style={{ color: CARDEA_MUTED }}>
              Feeling more than one? Pick Unsure.
            </p>

            <div className="mt-4 rounded-2xl border bg-white/85 p-4 shadow-sm" style={{ borderColor: 'rgba(25,43,63,0.08)' }}>
              <p className="mb-3 text-sm font-semibold text-[#192b3f]">
                Want to explore what&apos;s underneath it?
              </p>
              <button
                type="button"
                disabled={!selectedMeta}
                onClick={() => void openMoodChat()}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: CARDEA_DARK_GREEN }}
              >
                Open chat
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              {checkInError ? (
                <p className="mt-2 text-xs leading-relaxed text-[#9B1C31]">{checkInError}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-relaxed" style={{ color: CARDEA_MUTED }}>
                  two questions. one minute.
                </p>
                <div className="flex items-center gap-2">
                  {checkInSaved && (
                    <span className="text-xs font-semibold" style={{ color: CARDEA_DARK_GREEN }}>
                      saved
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!selectedMeta}
                    onClick={() => void saveMoodCheckIn()}
                    className="rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    style={{ background: CARDEA_DARK_GREEN }}
                  >
                    Save check-in
                  </button>
                </div>
              </div>
            </div>

            {selectedMeta ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ToolTile
                  toolId={selectedMeta.primary}
                  onOpen={(id) => void openTool(id, { saveCheckIn: true })}
                  count={toolUseCount(toolUsage, selectedMeta.primary, wellnessDayKey)}
                />
                <ToolTile
                  toolId={selectedMeta.secondary}
                  onOpen={(id) => void openTool(id, { saveCheckIn: true })}
                  count={toolUseCount(toolUsage, selectedMeta.secondary, wellnessDayKey)}
                  accent="rgba(172, 183, 168, 0.45)"
                />
              </div>
            ) : null}
          </div>

          {recentMoods.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
              No mood check-ins yet. Save one above and it will appear here.
            </p>
          ) : null}

          {recentMoods.length > 0 ? (
            <div className="mt-4 rounded-3xl bg-white/80 p-5 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CARDEA_MUTED }}>
                past week check-ins
              </p>
              <div
                className="relative flex h-4 rounded-full bg-[#f5f9f9] shadow-inner"
                style={{ background: recentMoodGradient }}
              >
                <div className="pointer-events-none h-full w-full rounded-full bg-gradient-to-r from-white/20 via-transparent to-white/20" />
                <div className="absolute inset-0 flex rounded-full">
                  {recentMoodSummaries.map((entry) => (
                    <div
                      key={entry.id}
                      className="group relative flex-1 cursor-default"
                      aria-label={`${entry.label}, ${entry.dateTime}`}
                    >
                      <span className="sr-only">
                        {entry.dateTime}: {entry.label}
                      </span>
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-xl bg-white px-3 py-2 text-xs opacity-0 shadow-lg ring-1 ring-[rgba(25,43,63,0.08)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: entry.color }}
                            aria-hidden
                          />
                          <span className="font-semibold text-[#192b3f]">{entry.label}</span>
                        </div>
                        <div className="mt-1 whitespace-nowrap" style={{ color: CARDEA_MUTED }}>
                          {entry.dateTime}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <MoodCheckInColorLegend />
              <p className="mt-2 text-xs" style={{ color: CARDEA_MUTED }}>
                Hover over a segment to see that check-in.
              </p>
            </div>
          ) : null}

          <div className="mt-4">
            <ToolTile
              toolId="micro-journal"
              onOpen={(id) => void openTool(id, { saveCheckIn: true })}
              count={toolUseCount(toolUsage, 'micro-journal', wellnessDayKey)}
            />
          </div>
        </Section>

        <Section id="crisis" label="Crisis support">
          <button
            type="button"
            onClick={() => openTool('crisis-reset')}
            className="group flex w-full items-center justify-between gap-6 rounded-2xl border-l-4 bg-white p-6 text-left shadow-sm transition hover:shadow-md"
            style={{ borderLeftColor: '#9B1C31' }}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#9B1C31]/10">
                <AlertCircle className="h-5 w-5 text-[#9B1C31]" />
              </div>
              <div>
                <h3
                  className="text-2xl text-[#192b3f]"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.07em' }}
                >
                  I need help right now
                </h3>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
                  A guided 4-step reset. Takes about 60 seconds.
                </p>
              </div>
            </div>
            <span className="hidden rounded-xl bg-[#9B1C31] px-4 py-2 text-sm font-semibold text-white sm:inline-flex">
              Start now →
            </span>
          </button>
        </Section>

        <Section id="suggested" label="Suggested Exercises">
          <div className="grid gap-4 md:grid-cols-2">
            {suggestedExercises.map((toolId, index) => (
              <SuggestedExerciseCard
                key={toolId}
                toolId={toolId}
                onOpen={openTool}
                tone={SUGGESTED_TONES[index % SUGGESTED_TONES.length]}
              />
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: CARDEA_MUTED }}>
            These exercises shift with your mood check-in on home or here.
          </p>
        </Section>

        <Section id="regulate" label="Regulate your body">
          <div className="grid gap-3 md:grid-cols-2">
            {(['breathing', 'grounding', 'physical-regulation'] as ToolId[]).map((toolId) => (
              <ToolTile
                key={toolId}
                toolId={toolId}
                onOpen={openTool}
                count={toolUseCount(toolUsage, toolId, wellnessDayKey)}
              />
            ))}
          </div>
        </Section>

        <Section id="mindset" label="Shift your mindset">
          <div className="grid gap-3 md:grid-cols-2">
            {(['reframes', 'safe-place'] as ToolId[]).map((toolId) => (
              <ToolTile
                key={toolId}
                toolId={toolId}
                onOpen={openTool}
                count={toolUseCount(toolUsage, toolId, wellnessDayKey)}
              />
            ))}
          </div>
        </Section>

        <Section id="parent" label="Be the parent">
          <div className="space-y-6">
            <TodayNudgeCard />
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CARDEA_MUTED }}>
                Reflection prompts
              </p>
              <ReflectionPromptsPanel onJournal={() => openTool('micro-journal')} />
            </div>
          </div>
        </Section>

        <Section id="journal" label="Past entries">
          <PastEntriesSection moodEntries={moodEntries} journalRefreshKey={journalRefreshKey} />
        </Section>

        <footer className="mb-6 mt-16 flex flex-col items-center gap-2 text-center">
          <Sparkles className="h-4 w-4" style={{ color: CARDEA_DARK_GREEN }} />
          <p className="text-xs leading-relaxed" style={{ color: CARDEA_MUTED }}>
            Cardea · you don&apos;t have to do this alone.
          </p>
        </footer>
      </main>

      {activeTool && activeMeta ? (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-[rgba(25,43,63,0.32)] px-4 py-6 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              className="mb-4 rounded-full px-4 py-2 text-sm font-semibold text-white"
              style={{ background: CARDEA_NAVY }}
            >
              ← Close
            </button>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CARDEA_MUTED }}>
              {activeMeta.category}
            </p>
            <h2 className="mb-2 text-2xl text-[#062A4A]" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.07em' }}>
              {activeMeta.title}
            </h2>
            <p className="mb-5 text-sm" style={{ color: CARDEA_MUTED }}>{activeMeta.short}</p>
            <ToolContent
              toolId={activeTool}
              onOpenTool={openTool}
              onMoodEntriesChanged={reloadMoodEntries}
              onJournalEntriesChanged={() => setJournalRefreshKey((k) => k + 1)}
            />
            <ToolActions
              onDone={() => setActiveTool(null)}
            />
          </motion.div>
        </div>
      ) : null}
      </div>
      <ResourcesRightNav />
    </div>
  )
}
