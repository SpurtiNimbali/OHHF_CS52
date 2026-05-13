import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpen,
  Brain,
  ChevronRight,
  Heart,
  Moon,
  RefreshCw,
  Smile,
  Snowflake,
  Sparkles,
  Tag,
  Wind,
} from 'lucide-react'
import { motion } from 'motion/react'
import {
  MOOD_VARIANTS,
  MoodHeartFill,
  moodShellBackgroundClasses,
  type MoodId,
  useMood,
} from '../mood'
import {
  CARDEA_DARK_GREEN,
  CARDEA_FONT_PRIMARY,
  CARDEA_LIGHT_BLUE,
  CARDEA_MUTED,
  CARDEA_NAVY,
} from '../ui/cardeaTokens'
import { ResourcesRightNav } from '../components/ResourcesRightNav'

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
  | 'breathing'
  | 'grounding'
  | 'cold-reset'
  | 'move-it-out'
  | 'body-scan'
  | 'mood-check-in'
  | 'name-it'
  | 'feelings-wheel'
  | 'micro-journal'
  | 'reframes'
  | 'safe-place'
  | 'stop-skill'
  | 'today-nudge'
  | 'night-reset'
  | 'crisis-reset'

type MoodLogEntry = {
  id: string
  date: string
  emotion: MoodId
  intensity?: number
  note?: string
}

type ToolUseEntry = {
  id: string
  date: string
  toolId: ToolId
  emotion: WellnessEmotion | null
}

type JournalEntry = {
  id: string
  date: string
  prompt: string
  text: string
  source: string
}

type Reframe = {
  id: string
  from: string
  to: string
  date: string
}

type Reflection = {
  id: string
  prompt: string
  text: string
  date: string
}

type SafePlace = {
  text: string
  date: string
}

type StoredValue<T> = T | (() => T)

const STORAGE = {
  moods: 'cardea-wellness-mood-log',
  tools: 'cardea-wellness-tool-log',
  journals: 'cardea-wellness-journals',
  reframes: 'cardea-wellness-reframes',
  reflections: 'cardea-wellness-parent-reflections',
  safePlace: 'cardea-wellness-safe-place',
}

const WELLNESS_EMOTIONS: Array<{
  id: WellnessEmotion
  moodId: MoodId
  label: string
  primary: ToolId
  secondary: ToolId
}> = [
  { id: 'happy', moodId: 'happy', label: 'Happy', primary: 'today-nudge', secondary: 'micro-journal' },
  { id: 'calm', moodId: 'calm', label: 'Calm', primary: 'body-scan', secondary: 'today-nudge' },
  { id: 'hopeful', moodId: 'hopeful', label: 'Hopeful', primary: 'reframes', secondary: 'today-nudge' },
  { id: 'overwhelmed', moodId: 'overwhelmed', label: 'Overwhelmed', primary: 'grounding', secondary: 'breathing' },
  { id: 'exhausted', moodId: 'exhausted', label: 'Exhausted', primary: 'cold-reset', secondary: 'micro-journal' },
  { id: 'angry', moodId: 'angry', label: 'Angry', primary: 'cold-reset', secondary: 'stop-skill' },
  { id: 'scared', moodId: 'scared', label: 'Scared', primary: 'reframes', secondary: 'safe-place' },
  { id: 'sad', moodId: 'sad', label: 'Sad', primary: 'micro-journal', secondary: 'name-it' },
  { id: 'disconnected', moodId: 'disconnected', label: 'Disconnected', primary: 'today-nudge', secondary: 'micro-journal' },
  { id: 'numb', moodId: 'numb', label: 'Unsure', primary: 'feelings-wheel', secondary: 'body-scan' },
]

const TOOL_META: Record<ToolId, {
  title: string
  short: string
  category: 'Regulate body' | 'Understand' | 'Shift mindset' | 'Connect' | 'Wind down' | 'Crisis'
  icon: typeof Wind
}> = {
  breathing: { title: 'Guided breathing', short: '3 calming patterns', category: 'Regulate body', icon: Wind },
  grounding: { title: '5-4-3-2-1 grounding', short: 'settle into your senses', category: 'Regulate body', icon: Sparkles },
  'cold-reset': { title: 'Cold reset', short: 'slow your stress response', category: 'Regulate body', icon: Snowflake },
  'move-it-out': { title: 'Move it out', short: '60 seconds of release', category: 'Regulate body', icon: Activity },
  'body-scan': { title: 'Body scan', short: 'soften head to toe', category: 'Regulate body', icon: Brain },
  'mood-check-in': { title: 'Daily mood check-in', short: 'two questions, one minute', category: 'Understand', icon: Heart },
  'name-it': { title: 'Name it to tame it', short: 'pick feeling words', category: 'Understand', icon: Tag },
  'feelings-wheel': { title: 'Feelings wheel', short: 'start when you are unsure', category: 'Understand', icon: Sparkles },
  'micro-journal': { title: 'Micro-journal', short: 'one prompt, one field', category: 'Understand', icon: BookOpen },
  reframes: { title: 'Reframes', short: 'a kinder thought', category: 'Shift mindset', icon: RefreshCw },
  'safe-place': { title: 'Safe place visualization', short: '90 seconds of steadiness', category: 'Shift mindset', icon: Heart },
  'stop-skill': { title: 'STOP skill', short: 'pause before the next step', category: 'Shift mindset', icon: AlertCircle },
  'today-nudge': { title: "Today's nudge", short: 'feel closer in one small way', category: 'Connect', icon: Heart },
  'night-reset': { title: 'Night reset', short: 'set the day down', category: 'Wind down', icon: Moon },
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

const journalPrompts = [
  'what are you carrying right now?',
  'what do you wish someone knew?',
  'where did you feel a little relief?',
  'what feels hardest today?',
  'what can wait until later?',
]

const presetReframes: Array<[string, string]> = [
  ['I have to handle everything', 'I can take one next step'],
  ["I can't fall apart", 'I can feel this and keep going'],
  ["I'm failing", "This is hard, and I'm trying"],
  ['I should be stronger', 'strength includes asking for help'],
  ["I'm so behind", 'I am doing what I can'],
  ["I can't do this", 'I have done hard things today'],
]

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

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function toolUseCount(toolLog: ToolUseEntry[], toolId: ToolId, emotion: WellnessEmotion | null) {
  const today = new Date()
  return toolLog.filter((entry) => {
    const usedAt = new Date(entry.date)
    if (Number.isNaN(usedAt.getTime()) || !isSameLocalDay(usedAt, today)) return false
    return entry.toolId === toolId && (!emotion || entry.emotion === emotion)
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

/**
 * AI-ready card resolver. Keep the return shape stable so this can later be
 * replaced with model/server recommendations without changing the UI.
 */
function resolveSuggestedExercises(emotion: WellnessEmotion | null, moodId: MoodId | null): ToolId[] {
  const key = emotion ?? moodId
  if (key === 'overwhelmed') return ['breathing', 'grounding', 'reframes', 'night-reset']
  if (key === 'exhausted') return ['cold-reset', 'body-scan', 'night-reset', 'safe-place']
  if (key === 'angry') return ['cold-reset', 'move-it-out', 'stop-skill', 'breathing']
  if (key === 'scared') return ['breathing', 'grounding', 'safe-place', 'reframes']
  if (key === 'sad') return ['body-scan', 'breathing', 'safe-place', 'night-reset']
  if (key === 'disconnected' || key === 'numb') return ['body-scan', 'grounding', 'safe-place', 'night-reset']
  if (key === 'happy' || key === 'hopeful') return ['move-it-out', 'reframes', 'breathing', 'night-reset']
  if (key === 'calm') return ['breathing', 'body-scan', 'safe-place', 'night-reset']
  return ['breathing', 'grounding', 'reframes', 'night-reset']
}

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

function QuickAccess({
  onOpenTool,
}: {
  onOpenTool: (toolId: ToolId) => void
}) {
  const items: Array<{
    label: string
    desc: string
    icon: typeof Wind
    action: () => void
  }> = [
    { label: 'Breathe', desc: 'slow it down', icon: Wind, action: () => onOpenTool('breathing') },
    { label: 'Check in', desc: 'notice it', icon: Smile, action: () => document.getElementById('understand')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    { label: 'Reframe', desc: 'shift it', icon: RefreshCw, action: () => onOpenTool('reframes') },
    { label: 'Connect', desc: 'be with them', icon: Heart, action: () => document.getElementById('parent')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
  ]

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(({ label, desc, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          onClick={action}
          className="group rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          style={{ borderColor: 'rgba(198,217,229,0.7)' }}
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#c6d9e5]/65 transition group-hover:bg-[#577568]/20">
            <Icon className="h-4 w-4 text-[#192b3f]" aria-hidden />
          </div>
          <div className="text-sm font-semibold text-[#192b3f]">{label}</div>
          <div className="mt-1 text-xs leading-snug" style={{ color: CARDEA_MUTED }}>
            {desc}
          </div>
        </button>
      ))}
    </div>
  )
}

function ToolActions({
  onDone,
  onTryElse,
}: {
  onDone: () => void
  onTryElse: () => void
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
      <button
        type="button"
        onClick={onTryElse}
        className="rounded-xl border bg-white px-5 py-2.5 text-sm font-semibold"
        style={{ borderColor: 'rgba(25, 43, 63, 0.16)', color: CARDEA_NAVY }}
      >
        Try something else
      </button>
    </div>
  )
}

function Timer({ seconds, label }: { seconds: number; label?: string }) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running || remaining <= 0) return
    const id = window.setTimeout(() => setRemaining((n) => n - 1), 1000)
    return () => window.clearTimeout(id)
  }, [remaining, running])

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="text-5xl font-bold tracking-wide text-[#062A4A]">{remaining}s</div>
      {label ? <p className="text-center text-sm" style={{ color: CARDEA_MUTED }}>{label}</p> : null}
      <button
        type="button"
        onClick={() => {
          if (remaining === 0) {
            setRemaining(seconds)
            setRunning(true)
            return
          }
          setRunning((r) => !r)
        }}
        className="rounded-xl border px-4 py-2 text-sm font-semibold"
        style={{ borderColor: CARDEA_DARK_GREEN, color: CARDEA_DARK_GREEN }}
      >
        {running ? 'Pause' : remaining === 0 ? 'Start again' : 'Start'}
      </button>
    </div>
  )
}

function BreathingTool() {
  const patterns = [
    { id: 'box', label: 'box', in: 4, hold: 4, out: 4 },
    { id: '478', label: '4-7-8', in: 4, hold: 7, out: 8 },
    { id: 'sigh', label: 'physiological sigh', in: 2, hold: 1, out: 6 },
  ]
  const [pattern, setPattern] = useState(patterns[0])
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')
  const [round, setRound] = useState(1)
  const [running, setRunning] = useState(true)
  const duration = phase === 'in' ? pattern.in : phase === 'hold' ? pattern.hold : pattern.out

  useEffect(() => {
    if (!running) return
    const id = window.setTimeout(() => {
      if (phase === 'in') setPhase(pattern.hold > 0 ? 'hold' : 'out')
      else if (phase === 'hold') setPhase('out')
      else {
        setRound((r) => (r >= 5 ? 1 : r + 1))
        setPhase('in')
      }
    }, duration * 1000)
    return () => window.clearTimeout(id)
  }, [duration, pattern.hold, phase, running])

  const label = phase === 'in' ? 'breathe in' : phase === 'hold' ? 'hold' : 'breathe out'
  const scale = phase === 'out' ? 0.72 : 1.12

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {patterns.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPattern(p)
              setPhase('in')
              setRound(1)
              setRunning(true)
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${pattern.id === p.id ? 'text-white' : 'bg-[#f5f9f9]'}`}
            style={{ background: pattern.id === p.id ? CARDEA_DARK_GREEN : undefined, color: pattern.id === p.id ? '#fff' : CARDEA_NAVY }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="relative flex h-64 w-64 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#c6d9e5]/35" />
          <div
            className="flex h-44 w-44 items-center justify-center rounded-full text-xl font-semibold tracking-[0.08em] text-white"
            style={{
              background: CARDEA_DARK_GREEN,
              transform: `scale(${scale})`,
              transition: `transform ${duration}s ease-in-out`,
            }}
          >
            {label}
          </div>
        </div>
        <p className="text-sm" style={{ color: CARDEA_MUTED }}>
          round {round} of 5
        </p>
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="rounded-xl border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: CARDEA_DARK_GREEN, color: CARDEA_DARK_GREEN }}
        >
          {running ? 'Pause' : 'Resume'}
        </button>
      </div>
    </div>
  )
}

function GroundingTool() {
  const steps = [
    { count: 5, sense: 'see' },
    { count: 4, sense: 'feel' },
    { count: 3, sense: 'hear' },
    { count: 2, sense: 'smell' },
    { count: 1, sense: 'taste' },
  ]
  const [idx, setIdx] = useState(0)
  const cur = steps[idx]
  return (
    <div className="space-y-4">
      {cur ? (
        <>
          <div className="rounded-2xl bg-[#f5f9f9] p-5 text-center">
            <div className="text-6xl font-bold text-[#062A4A]">{cur.count}</div>
            <p className="mt-2 text-lg font-semibold text-[#192b3f]">
              things you can {cur.sense}
            </p>
            <p className="mt-2 text-sm" style={{ color: CARDEA_MUTED }}>
              say them quietly. no typing needed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIdx((i) => i + 1)}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: CARDEA_DARK_GREEN }}
          >
            Next
          </button>
        </>
      ) : (
        <p className="rounded-2xl bg-[#f5f9f9] p-5 text-center text-sm text-[#192b3f]">
          you just helped your body find the room.
        </p>
      )}
    </div>
  )
}

function ColdResetTool() {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
        cold can cue your vagus nerve and slow your stress response.
      </p>
      {['cold water on your face', 'cold water on wrists', 'hold ice wrapped in cloth'].map((item) => (
        <div key={item} className="rounded-2xl border bg-white p-4" style={{ borderColor: 'rgba(25, 43, 63, 0.08)' }}>
          <p className="font-semibold text-[#192b3f]">{item}</p>
          <Timer seconds={60} label="stop if it feels unsafe." />
        </div>
      ))}
    </div>
  )
}

function MoveItOutTool() {
  const cues = ['shake out hands', 'stomp slowly', 'push a wall', 'roll shoulders']
  const [started, setStarted] = useState(false)
  const [t, setT] = useState(60)
  useEffect(() => {
    if (!started || t <= 0) return
    const id = window.setTimeout(() => setT((n) => n - 1), 1000)
    return () => window.clearTimeout(id)
  }, [started, t])
  const cue = cues[Math.min(Math.floor((60 - t) / 15), cues.length - 1)]
  return (
    <div className="text-center">
      <div className="my-5 text-7xl font-bold text-[#577568]">{t}</div>
      <p className="mb-5 text-xl font-semibold text-[#192b3f]">{started ? cue : 'ready when you are'}</p>
      <button
        type="button"
        onClick={() => {
          if (t === 0) setT(60)
          setStarted((s) => !s)
        }}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
        style={{ background: CARDEA_DARK_GREEN }}
      >
        {started ? 'Pause' : t === 0 ? 'Again' : 'Start'}
      </button>
    </div>
  )
}

function BodyScanTool() {
  const steps = [
    'notice your feet. let them be heavy.',
    'notice your belly. soften your breath.',
    'notice your shoulders. let them drop.',
    'notice your jaw. unclench gently.',
    'take one slow breath out.',
  ]
  const [idx, setIdx] = useState(0)
  return (
    <div className="text-center">
      <div className="mx-auto my-6 flex h-40 w-40 items-center justify-center rounded-full bg-[#577568]/10">
        <div className="h-28 w-28 rounded-full bg-[#577568]/20" />
      </div>
      <p className="mx-auto max-w-md text-xl leading-relaxed text-[#192b3f]">{steps[idx]}</p>
      <button
        type="button"
        onClick={() => setIdx((i) => Math.min(i + 1, steps.length - 1))}
        className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
        style={{ background: CARDEA_DARK_GREEN }}
      >
        {idx >= steps.length - 1 ? 'Stay here' : 'Next'}
      </button>
    </div>
  )
}

function MicroJournalTool({
  initialPrompt,
  source = 'micro-journal',
}: {
  initialPrompt?: string
  source?: string
}) {
  const [entries, setEntries] = useLocalState<JournalEntry[]>(STORAGE.journals, [])
  const [promptIdx, setPromptIdx] = useState(() => new Date().getDate() % journalPrompts.length)
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const prompt = initialPrompt ?? journalPrompts[promptIdx]
  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="font-semibold text-[#192b3f]">{prompt}</p>
        {!initialPrompt ? (
          <button
            type="button"
            onClick={() => setPromptIdx((i) => (i + 1) % journalPrompts.length)}
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: CARDEA_MUTED }}
          >
            another
          </button>
        ) : null}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="a short note to yourself..."
        className="min-h-[160px] w-full rounded-2xl border bg-[#f5f9f9] p-4 text-sm leading-relaxed outline-none"
        style={{ borderColor: CARDEA_LIGHT_BLUE, color: CARDEA_NAVY }}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: CARDEA_MUTED }}>
          {entries.length} saved
        </p>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => {
            setEntries([{ id: makeId('journal'), date: new Date().toISOString(), prompt, text: text.trim(), source }, ...entries])
            setText('')
            setSaved(true)
            window.setTimeout(() => setSaved(false), 1600)
          }}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: CARDEA_NAVY }}
        >
          Save
        </button>
      </div>
      {saved ? <p className="mt-2 text-sm font-semibold" style={{ color: CARDEA_DARK_GREEN }}>Saved.</p> : null}
    </div>
  )
}

function NameItTool({ onOpenTool }: { onOpenTool: (toolId: ToolId) => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (word: string) => {
    setSelected((cur) =>
      cur.includes(word) ? cur.filter((w) => w !== word) : cur.length >= 4 ? cur : [...cur, word],
    )
  }
  const recommendation: ToolId =
    selected.some((w) => ['scared', 'panicked', 'dreading', 'helpless'].includes(w))
      ? 'safe-place'
      : selected.some((w) => ['frustrated', 'resentful', 'powerless', 'overwhelmed'].includes(w))
        ? 'stop-skill'
        : selected.some((w) => ['drained', 'foggy', 'depleted', 'numb'].includes(w))
          ? 'body-scan'
          : 'micro-journal'

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: CARDEA_MUTED }}>pick up to four words. naming softens them.</p>
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

function FeelingsWheelTool({ onOpenTool }: { onOpenTool: (toolId: ToolId) => void }) {
  const families = Object.keys(emotionFamilies)
  const [family, setFamily] = useState(families[0])
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: CARDEA_MUTED }}>start broad. then pick a closer word.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {families.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFamily(item)}
            className={`rounded-2xl border p-4 text-sm font-semibold capitalize ${
              family === item ? 'text-white' : 'bg-white text-[#192b3f]'
            }`}
            style={{ background: family === item ? CARDEA_DARK_GREEN : undefined, borderColor: CARDEA_LIGHT_BLUE }}
          >
            {item}
          </button>
        ))}
      </div>
      <NameItTool onOpenTool={onOpenTool} />
      <Link
        to="/chat"
        className="inline-flex rounded-xl border px-4 py-2 text-sm font-semibold"
        style={{ borderColor: CARDEA_DARK_GREEN, color: CARDEA_DARK_GREEN }}
      >
        still unsure? talk it out
      </Link>
    </div>
  )
}

function ReframesTool() {
  const [reframes, setReframes] = useLocalState<Reframe[]>(STORAGE.reframes, [])
  const [index, setIndex] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const all = [...reframes.map((r) => [r.from, r.to] as [string, string]), ...presetReframes]
  const current = all[index % all.length]
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-2xl bg-[#f5f9f9] p-4">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_MUTED }}>the thought</p>
          <p className="text-lg text-[#3A525A] line-through">{current[0]}</p>
        </div>
        <ArrowRight className="mx-auto hidden h-5 w-5 text-[#acb7a8] sm:block" />
        <div className="rounded-2xl bg-[#577568]/10 p-4">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_DARK_GREEN }}>try instead</p>
          <p className="text-lg font-semibold text-[#192b3f]">{current[1]}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setIndex((i) => i + 1)}
        className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white"
        style={{ background: CARDEA_NAVY }}
      >
        Next reframe
      </button>
      <div className="mt-6 border-t pt-5" style={{ borderColor: 'rgba(25, 43, 63, 0.08)' }}>
        <p className="mb-3 text-sm font-semibold text-[#192b3f]">write your own</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="the thought" className="rounded-xl border bg-[#f5f9f9] px-3 py-2 text-sm outline-none" />
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="a kinder way" className="rounded-xl border bg-[#f5f9f9] px-3 py-2 text-sm outline-none" />
        </div>
        <button
          type="button"
          disabled={!from.trim() || !to.trim()}
          onClick={() => {
            setReframes([{ id: makeId('reframe'), from: from.trim(), to: to.trim(), date: new Date().toISOString() }, ...reframes])
            setFrom('')
            setTo('')
          }}
          className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: CARDEA_DARK_GREEN }}
        >
          Save reframe
        </button>
      </div>
    </div>
  )
}

function SafePlaceTool() {
  const [safePlace, setSafePlace] = useLocalState<SafePlace | null>(STORAGE.safePlace, null)
  const [draft, setDraft] = useState(safePlace?.text ?? '')
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#f5f9f9] p-5 text-sm leading-relaxed text-[#192b3f]">
        picture a place where your body loosens. notice the light. notice the sounds.
        let your shoulders drop. stay for three slow breaths.
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="write your safe place once..."
        className="min-h-[120px] w-full rounded-2xl border bg-white p-4 text-sm outline-none"
        style={{ borderColor: CARDEA_LIGHT_BLUE }}
      />
      <button
        type="button"
        disabled={!draft.trim()}
        onClick={() => setSafePlace({ text: draft.trim(), date: new Date().toISOString() })}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: CARDEA_DARK_GREEN }}
      >
        Save safe place
      </button>
      {safePlace ? <p className="text-xs" style={{ color: CARDEA_MUTED }}>saved for next time.</p> : null}
    </div>
  )
}

function StopSkillTool() {
  const steps = [
    ['Stop', 'pause where you are.'],
    ['Take a breath', 'one slow inhale. one longer exhale.'],
    ['Observe', 'notice body, thought, and urge.'],
    ['Proceed', 'choose the next kind step.'],
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {steps.map(([title, body]) => (
        <div key={title} className="rounded-2xl bg-[#f5f9f9] p-4">
          <p className="text-lg font-semibold text-[#192b3f]">{title}</p>
          <p className="mt-1 text-sm" style={{ color: CARDEA_MUTED }}>{body}</p>
        </div>
      ))}
    </div>
  )
}

function PastEntriesSection({ moodLog }: { moodLog: MoodLogEntry[] }) {
  const [journalEntries] = useLocalState<JournalEntry[]>(STORAGE.journals, [])
  const [reflections] = useLocalState<Reflection[]>(STORAGE.reflections, [])
  const [reframes] = useLocalState<Reframe[]>(STORAGE.reframes, [])
  const [safePlace] = useLocalState<SafePlace | null>(STORAGE.safePlace, null)

  const entries = useMemo(() => {
    const moodEntries = moodLog
      .filter((entry) => entry.note?.trim())
      .map((entry) => {
        const mood = moodVariantFor(entry.emotion)
        const emotion = WELLNESS_EMOTIONS.find((item) => item.moodId === entry.emotion)
        return {
          id: entry.id,
          date: entry.date,
          type: 'Mood check-in',
          title: emotion?.label ?? mood.label,
          text: entry.note?.trim() ?? '',
        }
      })

    const journals = journalEntries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      type: entry.source === 'night-reset' ? 'Night reset' : 'Micro-journal',
      title: entry.prompt,
      text: entry.text,
    }))

    const parentReflections = reflections.map((entry) => ({
      id: entry.id,
      date: entry.date,
      type: 'Parent reflection',
      title: entry.prompt,
      text: entry.text,
    }))

    const savedReframes = reframes.map((entry) => ({
      id: entry.id,
      date: entry.date,
      type: 'Reframe',
      title: entry.from,
      text: entry.to,
    }))

    const safePlaceEntry =
      safePlace?.text.trim()
        ? [{
            id: 'safe-place',
            date: safePlace.date,
            type: 'Safe place',
            title: 'Saved safe place',
            text: safePlace.text,
          }]
        : []

    return [
      ...moodEntries,
      ...journals,
      ...parentReflections,
      ...savedReframes,
      ...safePlaceEntry,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [journalEntries, moodLog, reframes, reflections, safePlace])

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
              <p className="text-sm font-semibold text-[#192b3f]">{entry.title}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#3A525A]">{entry.text}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function TodayNudgeTool({ onJournal }: { onJournal: (prompt: string) => void }) {
  const [idx, setIdx] = useState(() => new Date().getDate() % nudges.length)
  const [reflections, setReflections] = useLocalState<Reflection[]>(STORAGE.reflections, [])
  const [openPrompt, setOpenPrompt] = useState<string | null>(null)
  const [text, setText] = useState('')
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${CARDEA_NAVY}, #2c4566 62%, ${CARDEA_DARK_GREEN})` }}>
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <Heart className="h-5 w-5 text-[#c6d9e5]" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c6d9e5]/80">today&apos;s nudge</p>
            <h3 className="text-xl font-semibold text-white">a small invitation</h3>
          </div>
          <button type="button" onClick={() => setIdx((i) => (i + 1) % nudges.length)} className="ml-auto text-xs font-semibold text-[#c6d9e5]">
            another
          </button>
        </div>
        <p className="text-lg leading-relaxed text-[#c6d9e5]">{nudges[idx]}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {reflectionPrompts.map((prompt) => (
          <div key={prompt} className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: CARDEA_LIGHT_BLUE }}>
            <p className="mb-3 text-sm font-semibold text-[#192b3f]">{prompt}</p>
            {openPrompt === prompt ? (
              <>
                <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[90px] w-full rounded-xl border bg-[#f5f9f9] p-3 text-sm" />
                <button
                  type="button"
                  onClick={() => {
                    if (!text.trim()) return
                    setReflections([{ id: makeId('reflection'), prompt, text: text.trim(), date: new Date().toISOString() }, ...reflections])
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
              <button type="button" onClick={() => setOpenPrompt(prompt)} className="text-xs font-semibold" style={{ color: CARDEA_DARK_GREEN }}>
                Reflect →
              </button>
            )}
            <button type="button" onClick={() => onJournal(prompt)} className="ml-3 text-xs font-semibold" style={{ color: CARDEA_MUTED }}>
              journal
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function NightResetTool() {
  const prompts = ['one win from today', 'one thing to release', 'one intention for tomorrow']
  const [idx, setIdx] = useState(0)
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {prompts.map((_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= idx ? CARDEA_DARK_GREEN : CARDEA_LIGHT_BLUE }} />
        ))}
      </div>
      <MicroJournalTool initialPrompt={prompts[idx]} source="night-reset" />
      <button
        type="button"
        onClick={() => setIdx((i) => Math.min(i + 1, prompts.length - 1))}
        className="rounded-xl border px-4 py-2 text-sm font-semibold"
        style={{ borderColor: CARDEA_DARK_GREEN, color: CARDEA_DARK_GREEN }}
      >
        {idx >= prompts.length - 1 ? 'Stay here' : 'Next prompt'}
      </button>
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

function ToolContent({
  toolId,
  onOpenTool,
  journalPrompt,
}: {
  toolId: ToolId
  onOpenTool: (toolId: ToolId) => void
  journalPrompt: string | null
}) {
  if (toolId === 'breathing') return <BreathingTool />
  if (toolId === 'grounding') return <GroundingTool />
  if (toolId === 'cold-reset') return <ColdResetTool />
  if (toolId === 'move-it-out') return <MoveItOutTool />
  if (toolId === 'body-scan') return <BodyScanTool />
  if (toolId === 'mood-check-in') return <MoodCheckInTool />
  if (toolId === 'name-it') return <NameItTool onOpenTool={onOpenTool} />
  if (toolId === 'feelings-wheel') return <FeelingsWheelTool onOpenTool={onOpenTool} />
  if (toolId === 'micro-journal') return <MicroJournalTool initialPrompt={journalPrompt ?? undefined} />
  if (toolId === 'reframes') return <ReframesTool />
  if (toolId === 'safe-place') return <SafePlaceTool />
  if (toolId === 'stop-skill') return <StopSkillTool />
  if (toolId === 'today-nudge') return <TodayNudgeTool onJournal={(prompt) => onOpenToolWithPrompt(onOpenTool, prompt)} />
  if (toolId === 'night-reset') return <NightResetTool />
  return <CrisisResetTool />
}

function onOpenToolWithPrompt(onOpenTool: (toolId: ToolId) => void, prompt: string) {
  sessionStorage.setItem('cardea-wellness-pending-journal-prompt', prompt)
  onOpenTool('micro-journal')
}

function MoodCheckInTool() {
  const [mood, setMood] = useState<WellnessEmotion | null>(null)
  const [underneath, setUnderneath] = useState('')
  const [history, setHistory] = useLocalState<MoodLogEntry[]>(STORAGE.moods, [])
  const [saved, setSaved] = useState(false)
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
          setHistory([{ id: makeId('mood'), date: new Date().toISOString(), emotion: mood }, ...history].slice(0, 80))
          setUnderneath('')
          setSaved(true)
          window.setTimeout(() => setSaved(false), 1600)
        }}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: CARDEA_DARK_GREEN }}
      >
        Save check-in
      </button>
      {saved ? <p className="text-sm" style={{ color: CARDEA_DARK_GREEN }}>saved.</p> : null}
    </div>
  )
}

export default function WellnessTools() {
  const navigate = useNavigate()
  const { moodId, setMoodId, theme } = useMood()
  const [selectedEmotion, setSelectedEmotion] = useState<WellnessEmotion | null>(null)
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)
  const [moodLog, setMoodLog] = useLocalState<MoodLogEntry[]>(STORAGE.moods, [])
  const [toolLog, setToolLog] = useLocalState<ToolUseEntry[]>(STORAGE.tools, [])
  const [journalPrompt, setJournalPrompt] = useState<string | null>(null)
  const [checkInNote, setCheckInNote] = useState('')
  const [checkInSaved, setCheckInSaved] = useState(false)

  useEffect(() => {
    const pending = sessionStorage.getItem('cardea-wellness-pending-journal-prompt')
    if (pending) {
      setJournalPrompt(pending)
      sessionStorage.removeItem('cardea-wellness-pending-journal-prompt')
    }
  }, [activeTool])

  const selectedMeta = selectedEmotion ? WELLNESS_EMOTIONS.find((e) => e.id === selectedEmotion) ?? null : null
  const suggestedExercises = useMemo(
    () => resolveSuggestedExercises(selectedEmotion, moodId),
    [moodId, selectedEmotion],
  )
  const recentMoods = useMemo(() => moodLog.slice(0, 10).reverse(), [moodLog])
  const recentMoodSummaries = useMemo(
    () =>
      recentMoods.map((entry) => {
        const mood = moodVariantFor(entry.emotion)
        const emotion = WELLNESS_EMOTIONS.find((item) => item.moodId === entry.emotion)
        return {
          ...entry,
          label: emotion?.label ?? mood.label,
          color: mood.theme.heartFill,
          dateTime: formatCheckInDateTime(entry.date),
        }
      }),
    [recentMoods],
  )
  const recentMoodGradient = useMemo(() => {
    const colors = recentMoodSummaries.map((entry) => entry.color)
    return `linear-gradient(90deg, ${colors.join(', ')})`
  }, [recentMoodSummaries])

  function saveMoodCheckIn() {
    if (!selectedMeta) return
    setMoodLog([
      {
        id: makeId('mood'),
        date: new Date().toISOString(),
        emotion: selectedMeta.moodId,
        note: checkInNote.trim() || undefined,
      },
      ...moodLog,
    ].slice(0, 80))
    setCheckInNote('')
    setCheckInSaved(true)
    window.setTimeout(() => setCheckInSaved(false), 1800)
  }

  function openTool(toolId: ToolId) {
    setActiveTool(toolId)
    setToolLog([
      { id: makeId('tool'), date: new Date().toISOString(), toolId, emotion: selectedEmotion },
      ...toolLog,
    ].slice(0, 120))
  }

  function chooseEmotion(emotion: (typeof WELLNESS_EMOTIONS)[number]) {
    setSelectedEmotion(emotion.id)
    setMoodId(emotion.moodId)
    setCheckInSaved(false)
    setJournalPrompt(null)
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

        <QuickAccess onOpenTool={openTool} />

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
                  selected={selectedEmotion === emotion.id}
                  onClick={() => chooseEmotion(emotion)}
                />
              ))}
            </div>

            <div className="mt-4 rounded-2xl border bg-white/85 p-4 shadow-sm" style={{ borderColor: 'rgba(25,43,63,0.08)' }}>
              <label className="mb-2 block text-sm font-semibold text-[#192b3f]" htmlFor="wellness-underneath">
                What&apos;s underneath it?
              </label>
              <input
                id="wellness-underneath"
                type="text"
                value={checkInNote}
                onChange={(e) => setCheckInNote(e.target.value)}
                placeholder="a worry, a need, a body feeling..."
                className="w-full rounded-xl border bg-[#f5f9f9] px-4 py-3 text-sm text-[#192b3f] outline-none placeholder:text-[#acb7a8]"
                style={{ borderColor: CARDEA_LIGHT_BLUE }}
              />
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
                    onClick={saveMoodCheckIn}
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
                <ToolTile toolId={selectedMeta.primary} onOpen={openTool} count={toolUseCount(toolLog, selectedMeta.primary, selectedEmotion)} />
                <ToolTile toolId={selectedMeta.secondary} onOpen={openTool} count={toolUseCount(toolLog, selectedMeta.secondary, selectedEmotion)} accent="rgba(172, 183, 168, 0.45)" />
              </div>
            ) : null}
          </div>

          {selectedEmotion === 'disconnected' ? (
            <div className="mt-4 rounded-3xl border bg-white p-5 shadow-sm" style={{ borderColor: 'rgba(87, 117, 104, 0.28)' }}>
              <p className="mb-3 text-sm font-semibold text-[#192b3f]">
                it sounds like you want to feel closer. try this.
              </p>
              <ToolTile toolId="today-nudge" onOpen={openTool} accent="rgba(168, 230, 207, 0.65)" />
            </div>
          ) : null}

          {recentMoods.length > 2 ? (
            <div className="mt-4 rounded-3xl bg-white/80 p-5 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CARDEA_MUTED }}>recent check-ins</p>
              <div
                className="relative flex h-3 rounded-full bg-[#f5f9f9] shadow-inner"
                style={{ background: recentMoodGradient }}
                title={recentMoodSummaries
                  .map((entry) => `${entry.dateTime}: ${entry.label}`)
                  .join(' → ')}
              >
                <div className="h-full w-full rounded-full bg-gradient-to-r from-white/20 via-transparent to-white/20" />
                <div className="absolute inset-0 flex rounded-full">
                  {recentMoodSummaries.map((entry) => (
                    <div
                      key={entry.id}
                      className="group relative flex-1"
                      title={entry.note ? `${entry.dateTime}: ${entry.note}` : `${entry.dateTime}: ${entry.label}`}
                    >
                      <span className="sr-only">
                        {entry.dateTime}: {entry.label}
                      </span>
                      <div className="pointer-events-none absolute left-1/2 top-5 z-10 w-max max-w-[220px] -translate-x-1/2 rounded-xl bg-white px-3 py-2 text-xs opacity-0 shadow-lg ring-1 ring-[rgba(25,43,63,0.08)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
                        {entry.note && (
                          <div className="mt-1 max-w-[190px] whitespace-normal leading-snug text-[#3A525A]">
                            {entry.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex justify-between gap-3 text-[11px]" style={{ color: CARDEA_MUTED }}>
                <span>{recentMoodSummaries[0]?.dateTime}</span>
                <span>{recentMoodSummaries[recentMoodSummaries.length - 1]?.dateTime}</span>
              </div>
              <p className="mt-2 text-xs" style={{ color: CARDEA_MUTED }}>no judgment. just a gentle picture.</p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(['name-it', 'feelings-wheel', 'micro-journal'] as ToolId[]).map((toolId) => (
              <ToolTile
                key={toolId}
                toolId={toolId}
                onOpen={openTool}
                count={toolUseCount(toolLog, toolId, selectedEmotion)}
              />
            ))}
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
            These cards shift with your check-in. Later, this can use AI recommendations.
          </p>
        </Section>

        <Section id="regulate" label="Regulate your body">
          <div className="grid gap-3 md:grid-cols-2">
            {(['breathing', 'grounding', 'cold-reset', 'move-it-out', 'body-scan'] as ToolId[]).map((toolId) => (
              <ToolTile
                key={toolId}
                toolId={toolId}
                onOpen={openTool}
                count={toolUseCount(toolLog, toolId, selectedEmotion)}
              />
            ))}
          </div>
        </Section>

        <Section id="mindset" label="Shift your mindset">
          <div className="grid gap-3 md:grid-cols-2">
            {(['reframes', 'safe-place', 'stop-skill'] as ToolId[]).map((toolId) => (
              <ToolTile
                key={toolId}
                toolId={toolId}
                onOpen={openTool}
                count={toolUseCount(toolLog, toolId, selectedEmotion)}
              />
            ))}
          </div>
        </Section>

        <Section id="parent" label="Be the parent">
          <TodayNudgeTool onJournal={(prompt) => {
            setJournalPrompt(prompt)
            openTool('micro-journal')
          }} />
        </Section>

        <Section id="winddown" label="Wind down">
          <div className="grid gap-3 md:grid-cols-2">
            {(['night-reset', 'body-scan'] as ToolId[]).map((toolId) => (
              <ToolTile
                key={toolId}
                toolId={toolId}
                onOpen={openTool}
                count={toolUseCount(toolLog, toolId, selectedEmotion)}
              />
            ))}
          </div>
        </Section>

        <Section id="journal" label="Past entries">
          <PastEntriesSection moodLog={moodLog} />
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
              className="mb-4 text-sm font-semibold"
              style={{ color: CARDEA_MUTED }}
            >
              close
            </button>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CARDEA_MUTED }}>
              {activeMeta.category}
            </p>
            <h2 className="mb-2 text-2xl text-[#062A4A]" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.07em' }}>
              {activeMeta.title}
            </h2>
            <p className="mb-5 text-sm" style={{ color: CARDEA_MUTED }}>{activeMeta.short}</p>
            <ToolContent toolId={activeTool} onOpenTool={openTool} journalPrompt={journalPrompt} />
            <ToolActions
              onDone={() => {
                setJournalPrompt(null)
                setActiveTool(null)
              }}
              onTryElse={() => {
                setJournalPrompt(null)
                setActiveTool(null)
              }}
            />
          </motion.div>
        </div>
      ) : null}
      </div>
      <ResourcesRightNav />
    </div>
  )
}
