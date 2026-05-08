import { useState, useCallback, useEffect, useRef, KeyboardEvent, ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Heart, Shield, ArrowUp, ExternalLink, Phone, ArrowLeft } from 'lucide-react'

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
  description: string
  url?: string
  type: 'hotline' | 'exercise' | 'article'
}

type MessageRole = 'user' | 'assistant'

interface ApiUiRedirect {
  kind: string
  label: string
  path: string
  suggested: boolean
}

interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  citations?: Citation[]
  uiRedirects?: ApiUiRedirect[]
}

// ── Static data ───────────────────────────────────────────────────────────────

const CHIPS = [
  "I'm feeling anxious",
  'Help me calm down',
  'Breathing exercises',
  'I feel overwhelmed',
  'Sleep support',
]

const FEATURE_CARDS = [
  { Icon: MessageCircle, title: 'Confidential',  desc: 'Your conversations are private and secure'              },
  { Icon: Heart,         title: 'Compassionate', desc: 'Non-judgmental support whenever you need it'            },
  { Icon: Shield,        title: 'Resource-Rich', desc: 'Access to helpful tools and professional resources'     },
]

// ── WelcomeState ──────────────────────────────────────────────────────────────

function WelcomeState({ onChip }: { onChip: (label: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 24px', textAlign: 'center', fontFamily: FONT }}
    >
      {/* Heart pill — brand light-blue tint */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 56, borderRadius: 32, background: LIGHT_BLUE, marginBottom: 24 }}
      >
        <Heart style={{ width: 28, height: 28, color: NAVY }} strokeWidth={1.5} />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: NAVY }}
      >
        Welcome to Mental Health Support
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{ margin: '0 0 32px', fontSize: '0.875rem', color: MUTED, lineHeight: 1.65, maxWidth: 360 }}
      >
        I&apos;m here to listen and provide supportive resources. Your wellbeing
        matters, and you&apos;re not alone in this journey.
      </motion.p>

      {/* Feature cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 520, marginBottom: 32 }}>
        {FEATURE_CARDS.map(({ Icon, title, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 16px', background: '#fff', borderRadius: 14, border: `1.5px solid ${LIGHT_BLUE}` }}
          >
            <Icon style={{ width: 22, height: 22, color: MUTED }} strokeWidth={1.5} />
            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: NAVY }}>{title}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: MUTED, lineHeight: 1.5 }}>{desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Prompt chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
        {CHIPS.map((chip, i) => (
          <motion.button
            key={chip}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.05 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChip(chip)}
            style={{ padding: '8px 16px', borderRadius: 100, background: '#fff', border: `1.5px solid ${LIGHT_BLUE}`, fontSize: '0.82rem', fontWeight: 600, color: NAVY, cursor: 'pointer', fontFamily: FONT, transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = GREEN)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = LIGHT_BLUE)}
          >
            {chip}
          </motion.button>
        ))}
      </div>

      {/* Crisis note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
        style={{ fontSize: '0.75rem', color: MUTED, maxWidth: 360, lineHeight: 1.65 }}
      >
        <span style={{ fontWeight: 700, color: NAVY }}>Crisis Support:</span> If you&apos;re in
        crisis, please contact the{' '}
        <span style={{ fontWeight: 600 }}>988 Suicide &amp; Crisis Lifeline</span> (call or text
        988) or emergency services (911).
      </motion.p>
    </motion.div>
  )
}

// ── CitationCard ──────────────────────────────────────────────────────────────

function CitationCard({ citation }: { citation: Citation }) {
  const isHotline = citation.type === 'hotline'
  const isArticle = citation.type === 'article'
  const bg = isHotline ? '#fff5f5' : isArticle ? '#f0f7ff' : '#f0faf4'
  const border = isHotline ? '#fecaca' : isArticle ? '#bfdbfe' : '#bbf7d0'
  const color = isHotline ? '#b91c1c' : isArticle ? '#1d4ed8' : '#15803d'
  const Icon = isHotline ? Phone : ArrowUp

  const inner = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1px solid ${border}`, background: bg }}>
      <div style={{ flexShrink: 0, padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.6)', color }}>
        <Icon style={{ width: 12, height: 12 }} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 2px', fontSize: '0.72rem', fontWeight: 700, color }}>{citation.title}</p>
        <p style={{ margin: 0, fontSize: '0.72rem', color: '#374151', lineHeight: 1.5 }}>{citation.description}</p>
      </div>
      {citation.url && <ExternalLink style={{ width: 11, height: 11, color: MUTED, flexShrink: 0, marginTop: 2 }} />}
    </div>
  )

  return citation.url ? (
    <a href={citation.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
      {inner}
    </a>
  ) : inner
}

// ── In-app resource hints (API) ───────────────────────────────────────────────

function RedirectHints({ redirects, onNavigate }: { redirects: ApiUiRedirect[]; onNavigate: (path: string) => void }) {
  if (!redirects.length) return null
  return (
    <div
      style={{
        marginTop: 10,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(198, 217, 229, 0.35)',
        border: `1px solid ${LIGHT_BLUE}`,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ margin: '0 0 10px', fontSize: '0.72rem', fontWeight: 700, color: NAVY, letterSpacing: '0.04em' }}>
        ALSO IN THIS APP
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {redirects.map((r) => (
          <button
            key={r.kind}
            type="button"
            onClick={() => onNavigate(r.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1.5px solid ${r.suggested ? GREEN : LIGHT_BLUE}`,
              background: r.suggested ? '#fff' : 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: FONT,
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: NAVY }}>{r.label}</span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: r.suggested ? GREEN : MUTED,
                flexShrink: 0,
              }}
            >
              {r.suggested ? 'Suggested' : 'Open'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const navigate = useNavigate()
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{ display: 'flex', gap: 12, flexDirection: isUser ? 'row-reverse' : 'row' }}
    >
      {!isUser && (
        <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: LIGHT_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
          <Heart style={{ width: 14, height: 14, color: NAVY }} strokeWidth={2} />
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
          {message.content}
        </div>
        <span style={{ fontSize: '0.68rem', color: MUTED, padding: '0 4px' }}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {message.citations?.map((c) => <CitationCard key={c.id} citation={c} />)}
        {!isUser && message.uiRedirects && (
          <RedirectHints redirects={message.uiRedirects} onNavigate={(p) => navigate(p)} />
        )}
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
        <Heart style={{ width: 14, height: 14, color: NAVY }} strokeWidth={2} />
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
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [value, setValue] = useState('')
  const [dynamicChips, setDynamicChips] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const canSend = value.trim().length > 0 && !isLoading
  const chipRow = messages.length > 0 && dynamicChips.length > 0 ? dynamicChips : CHIPS

  const handleSend = useCallback(async (content: string) => {
    const text = content.trim()
    if (!text || isLoading) return

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }])
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = (await res.json()) as {
        error?: string
        answer?: string
        citations?: Array<{ chunkId: string; title: string; sourceUrl: string; excerpt: string }>
        suggestedQuestions?: string[]
        uiRedirects?: ApiUiRedirect[]
      }

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`)
      }

      const citations: Citation[] | undefined = data.citations?.map((c) => ({
        id: c.chunkId,
        title: c.title,
        description: c.excerpt,
        url: c.sourceUrl || undefined,
        type: 'article',
      }))

      const suggested = Array.isArray(data.suggestedQuestions) ? data.suggestedQuestions : []
      setDynamicChips(suggested.length >= 5 ? suggested.slice(0, 5) : suggested)

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.answer ?? '',
          timestamp: new Date(),
          citations,
          uiRedirects: data.uiRedirects,
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
            `I couldn’t reach the knowledge chat service (${msg}). Make sure the API server is running (\`npm run server:dev\`), ` +
            'the knowledge index is built (`npm run rag:build`), and `OPENAI_API_KEY` is set.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

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

      {/* ── Prompt chips ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto', background: OFF_WHITE, borderBottom: `1px solid ${LIGHT_BLUE}`, flexShrink: 0, scrollbarWidth: 'none' }}>
        {chipRow.map((chip, i) => (
          <motion.button
            key={`chip-${i}-${chip.slice(0, 24)}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => handleSend(chip)}
            disabled={isLoading}
            style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 100, background: '#fff', border: `1.5px solid ${LIGHT_BLUE}`, fontSize: '0.8rem', fontWeight: 600, color: NAVY, cursor: 'pointer', fontFamily: FONT, transition: 'border-color 0.15s', opacity: isLoading ? 0.5 : 1 }}
            onMouseEnter={e => { if (!isLoading) e.currentTarget.style.borderColor = GREEN }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = LIGHT_BLUE }}
          >
            {chip}
          </motion.button>
        ))}
      </div>

      {/* ── Thread ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {messages.length === 0 && !isLoading ? (
          <WelcomeState onChip={handleSend} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 16px', maxWidth: 680, margin: '0 auto' }}>
            <AnimatePresence initial={false}>
              {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
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
