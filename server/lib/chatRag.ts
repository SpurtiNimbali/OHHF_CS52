import OpenAI from 'openai'
import {
  KB_SYSTEM_PROMPT_PLACEHOLDER,
  buildFollowupUserPrompt,
  buildKnowledgeContextBlock,
  FOLLOWUP_SYSTEM,
} from '../prompts/kbChat.js'
import { loadKnowledgeIndex, getKnowledgeLoadError } from './knowledge/loadIndex.js'
import { embedQueryToScores } from './knowledge/retrieve.js'
import type { RetrievedChunk } from './knowledge/types.js'

const CHUNK_CHAR_BUDGET = 1400
const TOP_K = 8
const MAIN_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini'
const FOLLOWUP_MODEL = process.env.OPENAI_FOLLOWUP_MODEL ?? MAIN_MODEL

export type UiRedirect = {
  kind: 'mental_health_tools' | 'cardiologist_questions' | 'support_groups' | 'glossary'
  label: string
  path: string
  suggested: boolean
}

export type ChatCitation = {
  chunkId: string
  title: string
  sourceUrl: string
  excerpt: string
}

export type KbChatResult = {
  answer: string
  citations: ChatCitation[]
  suggestedQuestions: string[]
  uiRedirects: UiRedirect[]
  retrieved: RetrievedChunk[]
}

const REDIRECT_RULES: Array<{
  kind: UiRedirect['kind']
  label: string
  path: string
  patterns: RegExp
}> = [
  {
    kind: 'mental_health_tools',
    label: 'Mental health tools & mood check-in',
    path: '/home',
    patterns:
      /\b(breath|breathe|anxious|anxiety|calm|mood|stress|overwhelm|overwhelmed|sleep|panic|depress|depression|crisis|sad|worried|feel alone|cope|coping)\b/i,
  },
  {
    kind: 'cardiologist_questions',
    label: 'Questions for your cardiologist',
    path: '/resources?view=questions',
    patterns:
      /\b(cardiologist|cardiology|doctor|appointment|visit|procedure|surgery|medication|prescription|test results|lab|echo|ekg|ecg|diagnosis|hlhs|chd|congenital|heart defect|follow[- ]up)\b/i,
  },
  {
    kind: 'support_groups',
    label: 'Support & community resources',
    path: '/resources?view=support',
    patterns:
      /\b(support group|peer|community|financial|insurance|lodging|local|near me|zip|city|foundation|nonprofit|counseling|therapy)\b/i,
  },
  {
    kind: 'glossary',
    label: 'Medical glossary',
    path: '/resources?view=glossary',
    patterns: /\b(what is|what does|what are|define|definition|means?|meaning|term|glossary|abbreviation|acronym)\b/i,
  },
]

function buildUiRedirects(userMessage: string): UiRedirect[] {
  return REDIRECT_RULES.map((r) => ({
    kind: r.kind,
    label: r.label,
    path: r.path,
    suggested: r.patterns.test(userMessage),
  }))
}

function clip(s: string, n: number): string {
  const t = s.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n)}…`
}

function parseFollowups(raw: string): string[] {
  const t = raw.trim()
  try {
    const parsed = JSON.parse(t) as unknown
    if (!Array.isArray(parsed)) return []
    const out = parsed.filter((x): x is string => typeof x === 'string').slice(0, 5)
    const pad = 'What else should I know about caring for a child with a heart condition?'
    const filled = [...out]
    for (let i = filled.length; i < 5; i++) filled.push(pad)
    return filled.slice(0, 5)
  } catch {
    return [
      'What symptoms mean we should call a doctor right away?',
      'Where can I read more about this in plain language?',
      'What questions should I bring to our next cardiology visit?',
      'Are there support organizations for families like ours?',
      'What does this term mean in the medical glossary?',
    ]
  }
}

let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) {
    const key = (process.env.OPENAI_API_KEY ?? '').trim()
    if (!key) throw new Error('Missing OPENAI_API_KEY')
    openai = new OpenAI({ apiKey: key })
  }
  return openai
}

function messageText(content: string | null | (object | null)[] | undefined): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      if ('type' in part && part.type === 'text' && 'text' in part && typeof (part as { text: string }).text === 'string') {
        return (part as { text: string }).text
      }
      return ''
    })
    .join('')
}

async function embedQuery(text: string): Promise<number[]> {
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small'
  const res = await getOpenAI().embeddings.create({ model, input: text })
  const v = res.data[0]?.embedding
  if (!v?.length) throw new Error('Empty embedding response')
  return v
}

async function openaiChat(system: string, user: string, model: string, maxTokens: number, temperature: number): Promise<string> {
  const res = await getOpenAI().chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  const text = messageText(res.choices?.[0]?.message?.content)
  return text.trim()
}

export async function runKbChat(userMessage: string): Promise<KbChatResult> {
  const trimmed = userMessage.trim()
  if (!trimmed) throw new Error('Empty message')

  const items = await loadKnowledgeIndex()
  if (items.length === 0) {
    const hint = getKnowledgeLoadError()
    throw new Error(`Knowledge index unavailable${hint ? `: ${hint}` : ''}. Run: npm run rag:build`)
  }

  const qEmb = await embedQuery(trimmed)
  const retrieved = embedQueryToScores(qEmb, items, TOP_K)

  const forPrompt = retrieved.map((r) => ({
    title: r.title,
    sourceUrl: r.sourceUrl,
    text: clip(r.text, CHUNK_CHAR_BUDGET),
  }))

  const contextBlock = buildKnowledgeContextBlock(forPrompt)

  const answer = await openaiChat(
    KB_SYSTEM_PROMPT_PLACEHOLDER,
    `Knowledge context:\n${contextBlock}\n\n---\nUser message:\n${trimmed}`,
    MAIN_MODEL,
    1200,
    0.3,
  )

  const citations: ChatCitation[] = retrieved.map((r) => ({
    chunkId: r.id,
    title: r.title,
    sourceUrl: r.sourceUrl,
    excerpt: clip(r.text, 220),
  }))

  const followRaw = await openaiChat(
    FOLLOWUP_SYSTEM,
    buildFollowupUserPrompt(trimmed, answer),
    FOLLOWUP_MODEL,
    350,
    0.6,
  )

  const suggestedQuestions = parseFollowups(followRaw)
  const uiRedirects = buildUiRedirects(trimmed)

  return { answer, citations, suggestedQuestions, uiRedirects, retrieved }
}
