import { useState, useCallback, useEffect, useRef, KeyboardEvent, ChangeEvent } from 'react'
import type { CSSProperties } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isMoodCheckInChatState } from '../mood/moodCheckInNav'
import { markMoodEntryIfChat } from '../lib/moodEntries'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { MessageCircle, Heart, Shield, ArrowUp, ArrowLeft, CircleHelp, BookOpen, Users } from 'lucide-react'

// ── Brand tokens ──────────────────────────────────────────────────────────────

const NAVY       = '#192b3f'
const LIGHT_BLUE = '#c6d9e5'
const OFF_WHITE  = '#f5f9f9'
const MUTED      = '#acb7a8'
const GREEN      = '#577568'
const FONT       = 'Inter, system-ui, sans-serif'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Citation {
  id: string
  title: string
  url?: string
  type: 'hotline' | 'exercise' | 'article'
}

type MessageRole = 'user' | 'assistant'

type CompanionStageApi = 'open' | 'hear' | 'reflect' | 'intervene' | 'invite'

type SendCompanionOpts = Partial<{
  conversationStage: CompanionStageApi
  selectedEmotion: string | null
  selectedUnderneath: string | null
  /** Populated when user taps "I tried this" — server invite-stage check-ins use the ExerciseCard title. */
  inviteExerciseName: string | null
}>

interface ApiUiRedirect {
  kind: string
  label: string
  path: string
  suggested: boolean
  /** When true, show the large in-app suggestion card (user message matched). */
  prominent?: boolean
}

interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  citations?: Citation[]
  uiRedirects?: ApiUiRedirect[]
  companion?: {
    emotionChips?: string[] | null
    exercise?: { name: string; steps: string[] } | null
    toolCards?: { name: string; route: string; description?: string }[] | null
    uiRedirect?: { label: string; destination: string } | null
    detectedEmotion?: string | null
  }
}

const CHAT_SESSION_KEY = 'cardea-chat-session-v1'

type SerializedMessage = Omit<Message, 'timestamp'> & { timestamp: string }

type PersistedChatPayload = {
  version: 2
  messages: SerializedMessage[]
  dynamicChips: string[]
  companionStage?: 'open' | 'hear' | 'reflect' | 'intervene' | 'invite'
}

function loadChatSession(): {
  messages: Message[]
  dynamicChips: string[]
  companionStage: 'open' | 'hear' | 'reflect' | 'intervene' | 'invite'
} {
  try {
    const raw = sessionStorage.getItem(CHAT_SESSION_KEY)
    if (!raw) return { messages: [], dynamicChips: [], companionStage: 'open' }
    const data = JSON.parse(raw) as Partial<PersistedChatPayload>
    const vOk = data.version === 2 || data.version === 1
    if (!vOk || !Array.isArray(data.messages)) return { messages: [], dynamicChips: [], companionStage: 'open' }
    const messages = (data.messages as SerializedMessage[]).map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }))
    const dynamicChips = Array.isArray(data.dynamicChips)
      ? data.dynamicChips.filter((x): x is string => typeof x === 'string')
      : []
    const cs = data.companionStage
    const companionStage =
      cs === 'open' || cs === 'hear' || cs === 'reflect' || cs === 'intervene' || cs === 'invite' ? cs : 'open'
    return { messages, dynamicChips, companionStage }
  } catch {
    return { messages: [], dynamicChips: [], companionStage: 'open' }
  }
}

function saveChatSession(
  messages: Message[],
  dynamicChips: string[],
  companionStage: PersistedChatPayload['companionStage'],
) {
  const payload: PersistedChatPayload = {
    version: 2,
    messages: messages.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })),
    dynamicChips,
    companionStage,
  }
  sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(payload))
}

// ── Static data ───────────────────────────────────────────────────────────────

const CHIPS = [
  "Something's been sitting heavy on me",
  "I'm worried about what's ahead",
  'Help me calm my body down',
  "I'm overwhelmed by care logistics",
  'Explain something in plain language',
  "I'm not sure what I'm feeling",
]

const FEATURE_CARDS = [
  { Icon: MessageCircle, title: 'Private', desc: 'Space to say what can be hard to say elsewhere' },
  { Icon: Heart, title: 'Trauma-aware', desc: 'CBT-informed support that respects medical complexity' },
  { Icon: Shield, title: 'Resource-backed', desc: 'Guidance woven from trusted CHD & caregiver sources' },
]

/** Empty-chat welcome copy (static so the screen does not swap after load). Corpus-backed generation remains available at `GET /api/chat/welcome` for other use. */
const WELCOME_MARKDOWN =
  "This room is for the emotional weight that travels with caring for a child's heart — the vigilance alongside love, the questions that circle at night, the strength it takes to show up again and again.\n\n" +
  '**Cardea** uses a steady, trauma-informed tone: curiosity over judgment, small doable steps, and room to notice thoughts, body cues, and stress without fixing you.\n\n' +
  "Whenever you're ready, bring what's most alive for you right now — a worry, something you want to understand, a moment you're proud survived, or the thing you haven't said out loud yet. You can start from scratch or use a prompt below."

function shortLabel(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** Avoid duplicate footer links (same intent + path). */
function dedupeUiRedirects(redirects: ApiUiRedirect[]): ApiUiRedirect[] {
  const seen = new Set<string>()
  const out: ApiUiRedirect[] = []
  for (const r of redirects) {
    const key = `${r.kind}|${r.path}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

const assistantMarkdownComponents: Components = {
  p: ({ children }) => <p style={{ margin: '0 0 0.55em', lineHeight: 1.6 }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
  ul: ({ children }) => <ul style={{ margin: '0.35em 0', paddingLeft: '1.15em' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '0.35em 0', paddingLeft: '1.15em' }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: '0.12em 0' }}>{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: GREEN, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}
    >
      {children}
    </a>
  ),
  code: ({ className, children }) =>
    className ? (
      <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.78em', display: 'block', whiteSpace: 'pre-wrap' }}>
        {children}
      </code>
    ) : (
      <code style={{ fontSize: '0.86em', background: OFF_WHITE, padding: '0.12em 0.35em', borderRadius: 4, border: `1px solid ${LIGHT_BLUE}` }}>
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <pre
      style={{
        margin: '0.45em 0',
        padding: '10px 12px',
        background: OFF_WHITE,
        borderRadius: 8,
        border: `1px solid ${LIGHT_BLUE}`,
        overflowX: 'auto',
      }}
    >
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ margin: '0.45em 0', paddingLeft: '0.75em', borderLeft: `3px solid ${LIGHT_BLUE}`, color: MUTED }}>
      {children}
    </blockquote>
  ),
  h1: ({ children }) => <h1 style={{ margin: '0.4em 0 0.25em', fontSize: '1.05em', fontWeight: 700 }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ margin: '0.4em 0 0.25em', fontSize: '1em', fontWeight: 700 }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ margin: '0.35em 0 0.2em', fontSize: '0.95em', fontWeight: 700 }}>{children}</h3>,
}

// ── WelcomeState ──────────────────────────────────────────────────────────────

function WelcomeState({ onChip }: { onChip: (label: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: '40px 24px',
        textAlign: 'center',
        fontFamily: FONT,
      }}
    >
      {/* Chat avatar — round speech bubble */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: LIGHT_BLUE,
          marginBottom: 24,
        }}
      >
        <MessageCircle style={{ width: 28, height: 28, color: NAVY }} strokeWidth={1.5} />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 700, color: NAVY }}
      >
        Welcome in — this hour is yours
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          margin: '0 0 22px',
          fontSize: '0.8rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
      >
        Cardea · mental health support for heart families
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        style={{
          margin: '0 auto 28px',
          maxWidth: 520,
          width: '100%',
          textAlign: 'left',
          fontSize: '0.9rem',
          color: NAVY,
          lineHeight: 1.65,
        }}
      >
        <ReactMarkdown components={assistantMarkdownComponents}>{WELCOME_MARKDOWN}</ReactMarkdown>
      </motion.div>

      {/* Feature cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          width: '100%',
          maxWidth: 520,
          marginBottom: 28,
        }}
      >
        {FEATURE_CARDS.map(({ Icon, title, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.06 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '16px 12px',
              background: '#fff',
              borderRadius: 14,
              border: `1.5px solid ${LIGHT_BLUE}`,
            }}
          >
            <Icon style={{ width: 22, height: 22, color: MUTED }} strokeWidth={1.5} />
            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: NAVY }}>{title}</p>
            <p style={{ margin: 0, fontSize: '0.72rem', color: MUTED, lineHeight: 1.45, textAlign: 'center' }}>
              {desc}
            </p>
          </motion.div>
        ))}
      </div>

      <p
        style={{
          margin: '0 0 12px',
          fontSize: '0.78rem',
          fontWeight: 650,
          color: MUTED,
          width: '100%',
          maxWidth: 520,
        }}
      >
        Ways to start (tap one or type your own in the box below)
      </p>

      {/* Prompt chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
        {CHIPS.map((chip, i) => (
          <motion.button
            key={chip}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35 + i * 0.04 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChip(chip)}
            style={{
              padding: '8px 16px',
              borderRadius: 100,
              background: '#fff',
              border: `1.5px solid ${LIGHT_BLUE}`,
              fontSize: '0.8rem',
              fontWeight: 600,
              color: NAVY,
              cursor: 'pointer',
              fontFamily: FONT,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = GREEN)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = LIGHT_BLUE)}
          >
            {chip}
          </motion.button>
        ))}
      </div>

      {/* Crisis note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{ fontSize: '0.75rem', color: MUTED, maxWidth: 400, lineHeight: 1.65 }}
      >
        <span style={{ fontWeight: 700, color: NAVY }}>Crisis Support:</span> If you&apos;re in
        crisis, please contact the{' '}
        <span style={{ fontWeight: 600 }}>988 Suicide &amp; Crisis Lifeline</span> (call or text
        988) or emergency services (911).
      </motion.p>
    </motion.div>
  )
}

// ── Standalone intent resource cards (glossary, support, care-team — not in citations footer) ──

const INTENT_RESOURCE_UI: Record<
  string,
  {
    title: string
    description: string
    buttonLabel: string
    Icon: typeof CircleHelp
  }
> = {
  cardiologist_questions: {
    title: 'Questions for your care team',
    description: 'Save and organize prompts for cardiology visits and other appointments.',
    buttonLabel: 'Open question library',
    Icon: CircleHelp,
  },
  glossary: {
    title: 'Medical glossary',
    description: 'Look up heart and CHD terms in plain language.',
    buttonLabel: 'Open glossary',
    Icon: BookOpen,
  },
  support_groups: {
    title: 'Support & community resources',
    description: 'Connect with peers, groups, and practical help for families.',
    buttonLabel: 'Browse support resources',
    Icon: Users,
  },
}

function IntentResourceCard({
  redirect,
  onNavigate,
}: {
  redirect: ApiUiRedirect
  onNavigate: (path: string) => void
}) {
  const meta = INTENT_RESOURCE_UI[redirect.kind]
  const Icon = meta?.Icon ?? MessageCircle
  const title = meta?.title ?? redirect.label
  const description =
    meta?.description ?? 'Open this resource in the app.'
  const buttonLabel = meta?.buttonLabel ?? 'Open'

  return (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '14px 16px',
        borderRadius: 14,
        background: '#fff',
        border: `2px solid ${GREEN}`,
        boxShadow: '0 2px 8px rgba(25, 43, 63, 0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: 10,
            background: OFF_WHITE,
            border: `1px solid ${LIGHT_BLUE}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon style={{ width: 20, height: 20, color: GREEN }} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.82rem', fontWeight: 700, color: NAVY, fontFamily: FONT }}>
            {title}
          </p>
          <p style={{ margin: '0 0 12px', fontSize: '0.72rem', color: MUTED, lineHeight: 1.5, fontFamily: FONT }}>
            {description}
          </p>
          <button
            type="button"
            onClick={() => onNavigate(redirect.path)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: GREEN,
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 650,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function resolveAppPath(destination: string): string {
  if (destination.startsWith('/')) return destination
  if (destination.startsWith('?')) return `/resources${destination}`
  return destination
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onOpenCitations,
  onReflectChip,
}: {
  message: Message
  onOpenCitations: (citations: Citation[]) => void
  onReflectChip?: (chip: string, emotionId: string | null) => void
}) {
  const navigate = useNavigate()
  const isUser = message.role === 'user'
  const hasCitations = !isUser && Boolean(message.citations?.length)
  const footRedirects = dedupeUiRedirects(
    !isUser && message.uiRedirects?.length ? message.uiRedirects : [],
  )
  const prominentRedirects = footRedirects.filter((r) => r.prominent === true)
  const subtleRedirects = footRedirects.filter((r) => r.prominent !== true)
  const showFoot = hasCitations || subtleRedirects.length > 0
  const footMuted = '#8a9a96'
  const linkBtn: CSSProperties = {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontFamily: FONT,
    fontSize: 'inherit',
    color: GREEN,
    fontWeight: 600,
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    textAlign: 'left',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{ display: 'flex', gap: 12, flexDirection: isUser ? 'row-reverse' : 'row' }}
    >
      {!isUser && (
        <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: LIGHT_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
          <MessageCircle style={{ width: 16, height: 16, color: NAVY }} strokeWidth={2} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '75%', alignItems: isUser ? 'flex-end' : 'flex-start', width: isUser ? undefined : '100%' }}>
        <div style={{
          padding: '10px 16px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          fontSize: '0.875rem',
          lineHeight: 1.6,
          fontFamily: FONT,
          ...(isUser
            ? { background: NAVY, color: '#fff' }
            : { background: '#fff', color: NAVY, border: `1.5px solid ${LIGHT_BLUE}`, boxShadow: '0 1px 4px rgba(25,43,63,0.06)' }),
        }}>
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown components={assistantMarkdownComponents}>{message.content}</ReactMarkdown>
          )}
          {showFoot && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 8,
                borderTop: `1px solid rgba(198, 217, 229, 0.85)`,
                fontSize: '0.62rem',
                lineHeight: 1.45,
                color: footMuted,
              }}
            >
              {hasCitations && (
                <div style={{ marginBottom: subtleRedirects.length > 0 ? 6 : 0 }}>
                  <button
                    type="button"
                    onClick={() => onOpenCitations(message.citations!)}
                    style={linkBtn}
                  >
                    Citations
                  </button>
                </div>
              )}
              {subtleRedirects.length > 0 && (
                <div>
                  {subtleRedirects.map((r, i) => (
                    <span key={r.kind} style={{ display: 'inline' }}>
                      {i > 0 && <span style={{ margin: '0 0.25em', color: LIGHT_BLUE }}>·</span>}
                      <button type="button" onClick={() => navigate(r.path)} style={linkBtn}>
                        {shortLabel(r.label, 40)}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {!isUser && prominentRedirects.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            {prominentRedirects.map((r) => (
              <IntentResourceCard key={`${r.kind}-${r.path}`} redirect={r} onNavigate={(p) => navigate(p)} />
            ))}
          </div>
        )}
        {!isUser && message.companion?.emotionChips && message.companion.emotionChips.length > 0 && (
          <div style={{ marginTop: 8, width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 650, color: MUTED }}>
              What might be underneath? Tap what fits—or say it in your own words.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {message.companion.emotionChips.map((chip) => (
                <button
                  key={chip.slice(0, 40)}
                  type="button"
                  onClick={() => onReflectChip?.(chip, message.companion?.detectedEmotion ?? null)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 12,
                    border: `1.5px solid ${GREEN}`,
                    background: OFF_WHITE,
                    fontFamily: FONT,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: NAVY,
                    cursor: 'pointer',
                    textAlign: 'left',
                    textTransform: 'none',
                    fontVariant: 'normal',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
        {!isUser &&
          message.companion?.toolCards &&
          message.companion.toolCards.length > 0 && (
          <div style={{ marginTop: 8, width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 650, color: MUTED }}>
              {message.companion.toolCards.length === 1
                ? 'Wellness tool'
                : message.companion.toolCards.some((t) => t.description)
                  ? 'Wellness tools in the app'
                  : 'Gentle tools nearby'}
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: message.companion.toolCards.some((t) => t.description) ? 'column' : 'row',
                flexWrap: message.companion.toolCards.some((t) => t.description) ? 'nowrap' : 'wrap',
                gap: 8,
              }}
            >
              {message.companion.toolCards.map((t) => (
                <button
                  key={t.route + t.name}
                  type="button"
                  onClick={() => navigate(t.route)}
                  style={{
                    padding: t.description ? '10px 12px' : '8px 12px',
                    borderRadius: 10,
                    border: `1.5px solid ${LIGHT_BLUE}`,
                    background: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    textAlign: 'left',
                    width: t.description ? '100%' : undefined,
                  }}
                >
                  <span style={{ display: 'block', color: NAVY }}>{t.name}</span>
                  {t.description ? (
                    <span
                      style={{
                        display: 'block',
                        marginTop: 4,
                        fontSize: '0.7rem',
                        fontWeight: 400,
                        lineHeight: 1.45,
                        color: MUTED,
                      }}
                    >
                      {t.description}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}
        {!isUser && message.companion?.uiRedirect && (
          <div style={{ marginTop: 8, width: '100%' }}>
            <button
              type="button"
              onClick={() => navigate(resolveAppPath(message.companion!.uiRedirect!.destination))}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: `2px dashed ${GREEN}`,
                background: '#fff',
                fontSize: '0.78rem',
                fontWeight: 650,
                color: NAVY,
                cursor: 'pointer',
              }}
            >
              {message.companion.uiRedirect.label}
            </button>
          </div>
        )}
        <span style={{ fontSize: '0.68rem', color: MUTED, padding: '0 4px' }}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  )
}

// ── LoadingBubble ─────────────────────────────────────────────────────────────

function LoadingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      style={{ display: 'flex', gap: 12 }}
    >
      <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: LIGHT_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MessageCircle style={{ width: 16, height: 16, color: NAVY }} strokeWidth={2} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 16px', background: '#fff', border: `1.5px solid ${LIGHT_BLUE}`, borderRadius: '16px 16px 16px 4px', boxShadow: '0 1px 4px rgba(25,43,63,0.06)' }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            initial={{ y: 0 }}
            animate={{ y: -4 }}
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.45, delay: i * 0.15 }}
            style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: GREEN }}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const boot = loadChatSession()
  const [messages, setMessages] = useState<Message[]>(() => boot.messages)
  const [isLoading, setIsLoading] = useState(false)
  const [value, setValue] = useState('')
  const [dynamicChips, setDynamicChips] = useState<string[]>(() => boot.dynamicChips)
  const [convStage, setConvStage] = useState<CompanionStageApi>(() => boot.companionStage)
  const [selEmotion, setSelEmotion] = useState<string | null>(null)
  const [selUnder, setSelUnder] = useState<string | null>(null)
  const messagesRef = useRef<Message[]>(boot.messages)
  const moodCheckInRef = useRef<{ moodEntryId: string | null; emotionCheckIn: string | null }>({
    moodEntryId: null,
    emotionCheckIn: null,
  })
  const moodChatMarkedRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const state = location.state
    if (!isMoodCheckInChatState(state)) return
    moodCheckInRef.current = {
      moodEntryId: state.moodEntryId,
      emotionCheckIn: state.moodId,
    }
    if (state.prefill.trim()) {
      setValue(state.prefill.trim())
      window.requestAnimationFrame(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`
        el.focus()
      })
    }
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    saveChatSession(messages, dynamicChips, convStage)
  }, [messages, dynamicChips, convStage])

  const openCitations = useCallback(
    (citations: Citation[]) => {
      saveChatSession(messages, dynamicChips, convStage)
      navigate('/chat/citations', { state: { citations } })
    },
    [messages, dynamicChips, convStage, navigate],
  )

  const canSend = value.trim().length > 0 && !isLoading

  const handleSend = useCallback(
    async (content: string, opts?: SendCompanionOpts) => {
      const text = content.trim()
      if (!text || isLoading) return

      const historyPayload = messagesRef.current.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const stageForRequest =
        opts?.conversationStage ??
        convStage ??
        ('open' as CompanionStageApi)
      const selectedEmotion = opts?.selectedEmotion ?? selEmotion ?? null
      const selectedUnderneath = opts?.selectedUnderneath ?? selUnder ?? null

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() },
      ])
      setValue('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      setIsLoading(true)

      const moodEntryId = moodCheckInRef.current.moodEntryId
      if (moodEntryId && !moodChatMarkedRef.current) {
        moodChatMarkedRef.current = true
        void markMoodEntryIfChat(moodEntryId)
      }

      try {
        const payload = {
          message: text,
          history: historyPayload,
          conversationStage: stageForRequest,
          selectedEmotion,
          selectedUnderneath,
          ...(opts?.inviteExerciseName !== undefined
            ? { inviteExerciseName: opts.inviteExerciseName }
            : {}),
          sessionContext: {
            caregiverName: '',
            caregiverRole: '',
            emotionCheckIn: moodCheckInRef.current.emotionCheckIn,
            lastActivity: null,
          },
        }

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = (await res.json()) as {
          error?: string
          answer?: string
          nextStage?: CompanionStageApi
          emotionChips?: string[] | null
          exercise?: { name: string; steps: string[] } | null
          toolCards?: { name: string; route: string; description?: string }[] | null
          uiRedirect?: { label: string; destination: string } | null
          crisis?: boolean
          detectedEmotion?: string | null
          citations?: Array<{ chunkId: string; title: string; sourceUrl: string; excerpt: string }>
          suggestedQuestions?: string[]
          uiRedirects?: ApiUiRedirect[]
        }

        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)

        if (typeof data.nextStage === 'string') {
          const ns = data.nextStage
          if (ns === 'open' || ns === 'hear' || ns === 'reflect' || ns === 'intervene' || ns === 'invite') {
            setConvStage(ns)
          }
        }
        const citations: Citation[] | undefined = data.citations?.map((c) => ({
          id: c.chunkId,
          title: c.title,
          url: c.sourceUrl || undefined,
          type: 'article',
        }))

        const suggested = Array.isArray(data.suggestedQuestions) ? data.suggestedQuestions : []
        setDynamicChips(suggested.length >= 5 ? suggested.slice(0, 5) : suggested)

        const emotionChipList =
          Array.isArray(data.emotionChips) && data.emotionChips.length > 0 ? data.emotionChips : undefined
        const hasCompanionArtifacts =
          Boolean(emotionChipList?.length) ||
          Boolean(data.exercise) ||
          Boolean(data.toolCards?.length) ||
          Boolean(data.uiRedirect)

        const companionBlock = hasCompanionArtifacts
          ? {
              ...(emotionChipList ? { emotionChips: emotionChipList } : {}),
              exercise: data.exercise ?? undefined,
              toolCards:
                Array.isArray(data.toolCards) && data.toolCards.length > 0 ? data.toolCards : undefined,
              uiRedirect: data.uiRedirect ?? undefined,
              detectedEmotion:
                typeof data.detectedEmotion === 'string' ? data.detectedEmotion : undefined,
            }
          : undefined

        setSelEmotion(null)
        setSelUnder(null)

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.answer ?? '',
            timestamp: new Date(),
            citations,
            uiRedirects: data.uiRedirects,
            companion: companionBlock,
          },
        ])
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Something went wrong'
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              `Couldn’t reach the chat service (${msg}). Make sure \`npm run server:dev\` is running ` +
              'and `npm run rag:build` ran with `OPENAI_API_KEY` set.',
            timestamp: new Date(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, convStage, selEmotion, selUnder],
  )

  const handleReflectChip = useCallback(
    (chip: string, emotionId: string | null) => {
      setSelEmotion(emotionId)
      setSelUnder(chip)
      handleSend(chip, {
        conversationStage: 'reflect',
        selectedEmotion: emotionId,
        selectedUnderneath: chip,
      })
    },
    [handleSend],
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(value) }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: OFF_WHITE, fontFamily: FONT }}>

      {/* ── Top bar — Cardea brand ──────────────────────────────────────────── */}
      <header style={{ height: 52, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
        {/* Left: back + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 8, color: LIGHT_BLUE, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = LIGHT_BLUE)}
          >
            <ArrowLeft style={{ width: 18, height: 18 }} strokeWidth={2} />
          </button>
          <span style={{ fontFamily: 'var(--font-display, "Bebas Neue", sans-serif)', fontSize: 22, letterSpacing: '0.1em', color: OFF_WHITE }}>
            CARDEA
          </span>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>
            Mental Health Support
          </span>
        </div>

        {/* Right: available status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#34d399', opacity: 0.7, animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' }} />
            <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-flex' }} />
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: MUTED }}>Available</span>
        </div>
      </header>

      {/* ── Thread ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {messages.length === 0 && !isLoading ? (
          <WelcomeState onChip={handleSend} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 16px', maxWidth: 680, margin: '0 auto' }}>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onOpenCitations={openCitations}
                  onReflectChip={handleReflectChip}
                />
              ))}
              {isLoading && <LoadingBubble key="loading" />}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderTop: `1px solid ${LIGHT_BLUE}`, padding: '12px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: 680, margin: '0 auto' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', background: OFF_WHITE, border: `1.5px solid ${LIGHT_BLUE}`, borderRadius: 16, padding: '10px 14px', transition: 'border-color 0.2s' }}
            onFocusCapture={e => (e.currentTarget.style.borderColor = GREEN)}
            onBlurCapture={e => (e.currentTarget.style.borderColor = LIGHT_BLUE)}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Share what's on your mind..."
              disabled={isLoading}
              rows={1}
              style={{ flex: 1, resize: 'none', background: 'transparent', fontSize: '0.875rem', color: NAVY, fontFamily: FONT, outline: 'none', lineHeight: 1.6, maxHeight: 160, border: 'none' }}
            />
          </div>
          <motion.button
            onClick={() => handleSend(value)}
            disabled={!canSend}
            whileHover={canSend ? { scale: 1.06 } : {}}
            whileTap={canSend ? { scale: 0.94 } : {}}
            style={{ flexShrink: 0, width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: canSend ? 'pointer' : 'not-allowed', transition: 'background 0.2s', background: canSend ? GREEN : LIGHT_BLUE, color: canSend ? '#fff' : MUTED }}
            aria-label="Send message"
          >
            <ArrowUp style={{ width: 16, height: 16 }} strokeWidth={2.5} />
          </motion.button>
        </div>
        <p style={{ textAlign: 'center', fontSize: '0.68rem', color: MUTED, marginTop: 8, userSelect: 'none', fontFamily: FONT }}>
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>

    </div>
  )
}
