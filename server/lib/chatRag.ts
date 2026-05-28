import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js'
import { getLlmClient, resolveLlmModel } from './llmClient.js'
import {
  buildFollowupUserPrompt,
  buildKnowledgeContextBlock,
  FOLLOWUP_SYSTEM,
} from '../prompts/kbChat.js'
import {
  buildClassifierUser,
  buildCompanionSystem,
  buildEmotionChipGeneratorUser,
  buildHybridUnifiedSystem,
  buildInformationalRagSystem,
  buildWelcomeOpenerSystem,
  buildWelcomeOpenerUser,
  type ClassifierIntent,
  type ConversationStage as PromptConversationStage,
  type SessionContextPrompt,
} from '../prompts/companionPrompts.js'
import { detectCrisisKeywords } from '../../src/lib/crisisKeywords.js'
import {
  looksLikeCopingRequest,
  matchCopingRequest,
  shouldUseCopingBranch,
} from './copingRequestMatch.js'
import { loadEmotionMap, safeDetectedEmotion } from './emotionMapLoader.js'
import {
  buildToolRoute,
  listAllWellnessToolsForChat,
  resolveSelectedTool,
  toWellnessToolChatCard,
  type ResolvedWellnessTool,
  type WellnessToolId,
} from '../../src/lib/wellnessToolRegistry.js'
import { loadKnowledgeIndex, getKnowledgeLoadError } from './knowledge/loadIndex.js'
import { embedQueryToScores } from './knowledge/retrieve.js'
import type { RetrievedChunk } from './knowledge/types.js'

const CHUNK_CHAR_BUDGET = 1400
const TOP_K = 8
const MAIN_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini'
const FOLLOWUP_CHAT_MODEL =
  process.env.OPENAI_FOLLOWUP_MODEL?.trim() || MAIN_CHAT_MODEL

export type UiRedirect = {
  kind: 'mental_health_tools' | 'cardiologist_questions' | 'support_groups' | 'glossary'
  label: string
  path: string
  /** True when the user's message matched (legacy / scripts). */
  suggested: boolean
  /** True when the match came from the user's words; show a large in-app suggestion. */
  prominent: boolean
}

export type ChatCitation = {
  chunkId: string
  title: string
  sourceUrl: string
  excerpt: string
}

export type CompanionConversationStage =
  import('../prompts/companionPrompts.js').ConversationStage

export type CompanionSessionContext = {
  caregiverName: string
  caregiverRole: string
  emotionCheckIn: string | null
  lastActivity: string | null
}

export type CompanionHistoryItem = { role: 'user' | 'assistant'; content: string }

/** Full request payload for companion + RAG flow (extends legacy `message`). */
export type CompanionChatRequest = {
  message: string
  history?: CompanionHistoryItem[]
  sessionContext?: Partial<CompanionSessionContext>
  conversationStage?: CompanionConversationStage
  selectedEmotion?: string | null
  selectedUnderneath?: string | null
  /** Invite-stage: exercise title from the ExerciseCard the user just tried (for grounded check-in). */
  inviteExerciseName?: string | null
}

export type CompanionExercisePayload = { name: string; steps: string[] }
export type CompanionToolPayload = { name: string; route: string; description?: string }
export type CompanionUiRedirect = { label: string; destination: string }

export type KbChatResult = {
  answer: string
  citations: ChatCitation[]
  suggestedQuestions: string[]
  uiRedirects: UiRedirect[]
  retrieved: RetrievedChunk[]
}

export type CompanionChatResult = KbChatResult & {
  nextStage: CompanionConversationStage
  emotionChips: string[] | null
  exercise: CompanionExercisePayload | null
  toolCards: CompanionToolPayload[] | null
  uiRedirect: CompanionUiRedirect | null
  crisis: boolean
  /** Emotion row id inferred for companion HEAR chips (matches emotionMap ids). */
  detectedEmotion: string | null
  /** Classifier intent label; `CRISIS` when heuristic triage fired. */
  classifierIntent: string | null
}

function fallbackToolIdForEmotion(emotionId: string): WellnessToolId {
  switch (emotionId) {
    case 'angry':
    case 'exhausted':
      return 'physical-regulation'
    case 'scared':
      return 'safe-place'
    case 'sad':
    case 'numb':
      return 'name-it'
    case 'guilty':
      return 'reframes'
    case 'disconnected':
      return 'today-nudge'
    case 'helpless':
      return 'grounding'
    case 'overwhelmed':
    case 'anxious':
    case 'unknown':
    default:
      return 'breathing'
  }
}

function toCompanionToolPayload(tool: ResolvedWellnessTool | null): CompanionToolPayload | null {
  if (!tool) return null
  const card = toWellnessToolChatCard(tool)
  return { name: card.name, route: card.route, description: card.description }
}

function clip(s: string, n: number): string {
  const t = s.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n)}…`
}

const HYBRID_EMOTION_MAX_WORDS = 70
const HYBRID_INFO_MAX_WORDS = 100
/** Standalone informational RAG (non-hybrid) word cap. */
const INFO_RAG_MAX_WORDS = 160

/** Procedure/fact wording that belongs in the informational paragraph, not emotional. */
const HYBRID_EMOTIONAL_FACTUAL_RE =
  /\b(after (the )?surgery|recovery room|intensive care unit|\bicu\b|breathing tube|tubes and monitors|anesthesiologist|operating room|will be taken to|monitoring and recovery|medical team will|may have some tubes|hypoplastic left heart|\bhlhs\b|congenital heart defect|left side of the heart|syndrome is a|is a complex|underdeveloped)\b/i

/** User-message restatement at the start of the informational paragraph. */
const HYBRID_INFO_RESTATE_RE =
  /^(you are|you're|i am|i'm)\b|need to know what happens|terrified about tomorrow|want to know what happens/i

/** Stock validation / mirror lines to strip from companion emotional replies. */
const COMPANION_TEMPLATE_SENTENCE_RE =
  /\b(completely understandable|completely valid|that kind of|it's a lot to handle|it is a lot to handle|it's tough to be in this space|incredibly challenging|someone you love so deeply|you're doing your best|amplify your feelings)\b/i

/** Generic prep-talk openers that skip emotional acknowledgment (common in HYBRID para 1). */
const COMPANION_COLD_EMOTIONAL_RE =
  /\b(having more information can help|being informed can help|more information can help you feel|feel more prepared for the discussion|help you feel more prepared|can help you feel more prepared|being prepared can help|learning more before the appointment can help)\b/i

const COMPANION_RESTATE_OPENER_RE =
  /^(you're feeling|you are feeling|you're scared|you're stressed|you're nervous|you're running|you are scared|you are stressed)/i

const INLINE_CITATION_RE = /\[(\d+)\]/g

/** Protect [1]-style markers from sentence-splitting regexes during polish. */
function shieldInlineCitations(text: string): { shielded: string; markers: string[] } {
  const markers: string[] = []
  const shielded = text.replace(INLINE_CITATION_RE, (m) => {
    const idx = markers.push(m) - 1
    return `\uE000CIT${idx}\uE001`
  })
  return { shielded, markers }
}

function unshieldInlineCitations(text: string, markers: string[]): string {
  if (!markers.length) return text
  return text.replace(/\uE000CIT(\d+)\uE001/g, (_, idx) => markers[Number(idx)] ?? _)
}

/** Remove questions and UI-pointer sentences from hybrid body paragraphs. */
function polishHybridParagraph(text: string): string {
  let t = text.trim()
  const mi = t.indexOf('[MISSING INFORMATION')
  if (mi !== -1) t = t.slice(0, mi).trimEnd()

  const { shielded, markers } = shieldInlineCitations(t)
  t = shielded

  const parts = t.match(/[^.!?\n]+[.!?]?/g) ?? [t]
  const kept: string[] = []
  for (const part of parts) {
    const s = part.trim()
    if (!s) continue
    if (/\?\s*$/.test(s)) continue
    if (
      /^(would you like|if you(?:'d| would) like|do you want|are you wondering|what specific|is it about|let me know|does that help|can i help you)/i.test(
        s,
      )
    ) {
      continue
    }
    if (/resources below/i.test(s)) continue
    kept.push(/[.!]$/.test(s) ? s : `${s}.`)
  }
  return unshieldInlineCitations(kept.join(' ').trim(), markers)
}

/** Drop mirror openers, template filler, and vague practice pitches from emotional prose. */
function polishCompanionEmotionalAnswer(text: string, userMessage: string): string {
  let t = polishHybridParagraph(text)
  const userNorm = userMessage.trim().toLowerCase()
  const parts = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [t]
  const kept: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const s = parts[i].trim()
    if (!s) continue
    const sn = s.toLowerCase()
    if (COMPANION_TEMPLATE_SENTENCE_RE.test(s)) continue
    if (COMPANION_COLD_EMOTIONAL_RE.test(s)) continue
    if (/^if you(?:'d| would) like/i.test(s) && /micro-practice|grounding|exercise/i.test(s)) continue
    const overlap = wordOverlapRatio(sn, userNorm)
    if (COMPANION_RESTATE_OPENER_RE.test(s) && overlap > 0.2) continue
    if (i === 0 && overlap > 0.32) continue
    if (i < 2 && overlap > 0.45) continue
    kept.push(/[.!]$/.test(s) ? s : `${s}.`)
  }
  t = kept.join(' ').trim()
  if (!t) return fallbackCompanionEmotionalOpener(userMessage)
  return t
}

function fallbackCompanionEmotionalOpener(userMessage: string): string {
  const m = userMessage.toLowerCase()
  if (/\b(appointment|cardiology|cardiologist|visit)\b/.test(m) && /\b(stress|worried|nervous|anxious|scared)\b/.test(m)) {
    return 'A cardiology visit on the calendar can loom large — especially when you are already carrying a lot.'
  }
  if (/\b(appointment|cardiology|cardiologist)\b/.test(m)) {
    return 'Walking into cardiology with questions on your mind is a lot; the wait alone can wear on you.'
  }
  if (/\b(monitor|beep|alarm|icu|hospital room)\b/.test(m)) {
    return 'Those sounds in the room can keep your nervous system braced even when you know the team is watching closely.'
  }
  if (/\b(sleep|empty|exhaust|tired)\b/.test(m)) {
    return 'Going days without real rest can leave you raw in ways that are hard to explain to anyone outside the room.'
  }
  if (/\b(fail|guilt|not enough)\b/.test(m)) {
    return 'Guilt hits hard in this world — especially when you are giving everything you have.'
  }
  if (/\b(stress|worried|nervous|anxious|scared)\b/.test(m)) {
    return 'The stress you are carrying before tomorrow deserves room — not a quick fix.'
  }
  return 'What you are carrying right now sounds heavy.'
}

/** Drop factual/procedure sentences that leaked into the emotional paragraph. */
function polishHybridEmotionalParagraph(text: string, userMessage = ''): string {
  let t = userMessage ? polishCompanionEmotionalAnswer(text, userMessage) : polishHybridParagraph(text)
  const parts = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [t]
  const kept = parts
    .map((p) => p.trim())
    .filter((s) => s.length > 0 && !HYBRID_EMOTIONAL_FACTUAL_RE.test(s))
  if (kept.length > 0) t = kept.join(' ').trim()
  return t || (userMessage ? fallbackCompanionEmotionalOpener(userMessage) : t)
}

/** Trim to max words without cutting mid-sentence (no trailing ellipsis). */
function clipWordsAtSentence(text: string, maxWords: number): string {
  const trimmed = text.trim()
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return trimmed

  const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [trimmed]
  const kept: string[] = []
  let count = 0
  for (const sent of sentences) {
    const s = sent.trim()
    if (!s) continue
    const w = s.split(/\s+/).filter(Boolean).length
    if (count + w > maxWords && kept.length > 0) break
    kept.push(s)
    count += w
  }
  if (kept.length > 0) return kept.join(' ').trim()
  return words.slice(0, maxWords).join(' ')
}

function wordOverlapRatio(a: string, b: string): number {
  const wa = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3),
  )
  const wb = new Set(
    b
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3),
  )
  if (wa.size === 0) return 0
  let inter = 0
  for (const w of wa) if (wb.has(w)) inter++
  return inter / wa.size
}

/** Remove opening sentences that mirror the user's message (belongs in emotional para, not info). */
function polishHybridInformationalParagraph(text: string, userMessage: string): string {
  let t = polishHybridParagraph(text)
  const userNorm = userMessage.trim().toLowerCase()
  const parts = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [t]
  const kept = parts
    .map((p) => p.trim())
    .filter((s) => {
      if (!s) return false
      const sn = s.toLowerCase()
      if (HYBRID_INFO_RESTATE_RE.test(sn) && wordOverlapRatio(sn, userNorm) > 0.35) return false
      if (/^you are terrified\b/i.test(s) || /^you're terrified\b/i.test(s)) return false
      if (/need to know what happens in the recovery room/i.test(sn)) return false
      return true
    })
  if (kept.length > 0) t = kept.join(' ').trim()
  return t
}

function splitInformationalFollowUp(raw: string): { body: string; followUp: string } {
  const t = raw.trim()
  const blocks = t.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean)
  if (blocks.length >= 2 && /\?\s*$/.test(blocks[blocks.length - 1])) {
    return { body: blocks.slice(0, -1).join(' '), followUp: blocks[blocks.length - 1] }
  }
  const sentences = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [t]
  if (sentences.length >= 2 && /\?\s*$/.test(sentences[sentences.length - 1].trim())) {
    return {
      body: sentences.slice(0, -1).join(' ').trim(),
      followUp: sentences[sentences.length - 1].trim(),
    }
  }
  return { body: t, followUp: '' }
}

function fallbackInformationalFollowUp(userMessage: string): string {
  const t = userMessage.trim().toLowerCase()
  const topics: string[] = []
  if (/\bhlhs|hypoplastic left heart\b/.test(t)) topics.push('how HLHS affects daily care', 'what to ask at the cardiology visit')
  else if (/\bcardiologist|cardiology appointment\b/.test(t)) topics.push('what to expect at the appointment', 'questions to bring to the visit')
  else if (/\b(surgery|recovery|icu|recovery room)\b/.test(t)) topics.push('what happens right after surgery', 'how long recovery usually takes')
  else if (/\b(monitor|beep|alarm)\b/.test(t)) topics.push('what those monitor alerts usually mean', 'when to alert the care team')
  if (topics.length >= 2) {
    return `Would you like to know more about ${topics[0]}, or ${topics[1]}?`
  }
  if (topics.length === 1) {
    return `Would you like to know more about ${topics[0]}, or something else on your mind?`
  }
  return 'Would you like to know more about what we touched on, or a different part of this?'
}

function polishInformationalFollowUpQuestion(text: string): string {
  let t = text.trim()
  if (!/\?\s*$/.test(t)) t = `${t.replace(/[.!]+\s*$/, '')}?`
  return t
}

/** Body capped at ~85–160 words; optional follow-up question after (not capped). */
function polishInformationalAnswer(
  text: string,
  userMessage: string,
  opts?: { includeFollowUp?: boolean; maxBodyWords?: number },
): string {
  const includeFollowUp = opts?.includeFollowUp !== false
  const maxBodyWords = opts?.maxBodyWords ?? INFO_RAG_MAX_WORDS
  const { body, followUp } = splitInformationalFollowUp(text)
  let b = polishHybridInformationalParagraph(polishHybridParagraph(body), userMessage)
  b = b.replace(/\n\s*\n+/g, ' ').replace(/\s+/g, ' ').trim()
  b = clipWordsAtSentence(b, maxBodyWords)
  if (!includeFollowUp) return b
  const q = followUp.trim()
    ? polishInformationalFollowUpQuestion(followUp)
    : fallbackInformationalFollowUp(userMessage)
  if (!b) return q
  return `${b}\n\n${q}`.trim()
}

type HybridSplit = { emotional: string; informational: string; closing: string }

function polishHybridClosing(text: string): string {
  let t = text.trim()
  if (!t) return ''
  const parts = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [t]
  const questions = parts.map((p) => p.trim()).filter((s) => /\?\s*$/.test(s))
  if (questions.length > 0) t = questions[questions.length - 1]
  if (!/\?\s*$/.test(t)) t = `${t.replace(/[.!]+\s*$/, '')}?`
  return t
}

/** Fallback when the model omits the closing line (generic, not tied to one scenario). */
function fallbackHybridClosing(userMessage: string): string {
  const t = userMessage.trim()
  const named =
    t.match(/\b(HLHS|hypoplastic left heart syndrome)\b/i)?.[1] ||
    t.match(/\b(cardiologist|cardiology appointment|surgery|recovery room|ICU)\b/i)?.[1] ||
    t.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:syndrome|defect|condition)\b/)?.[0]
  const topic = named ? String(named).trim().toLowerCase() : 'what we discussed'
  return `Is there something else you're worried about, or would you like more information on ${topic}?`
}

/** Split unified HYBRID reply: emotional paragraph, informational paragraph, closing question. */
function splitHybridAnswer(raw: string): HybridSplit {
  const t = raw.trim()
  const blocks = t.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean)
  if (blocks.length >= 3) {
    return {
      emotional: blocks[0],
      informational: blocks.slice(1, -1).join('\n\n'),
      closing: blocks[blocks.length - 1],
    }
  }
  if (blocks.length === 2) {
    const second = blocks[1]
    const sents = second.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [second]
    if (sents.length >= 2 && /\?\s*$/.test(sents[sents.length - 1].trim())) {
      return {
        emotional: blocks[0],
        informational: sents.slice(0, -1).join(' ').trim(),
        closing: sents[sents.length - 1].trim(),
      }
    }
    return { emotional: blocks[0], informational: blocks[1], closing: '' }
  }
  const sentences = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [t]
  if (sentences.length >= 2 && /\?\s*$/.test(sentences[sentences.length - 1].trim())) {
    const closing = sentences[sentences.length - 1].trim()
    const body = sentences.slice(0, -1)
    const mid = Math.min(3, Math.max(2, Math.floor(body.length / 2)))
    return {
      emotional: body.slice(0, mid).join(' ').trim(),
      informational: body.slice(mid).join(' ').trim(),
      closing,
    }
  }
  return { emotional: t, informational: '', closing: '' }
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

async function openAiChat(
  system: string,
  user: string,
  model: string,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const res = await getLlmClient().chat.completions.create({
    model: resolveLlmModel(model),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: maxTokens,
    temperature,
  })
  const text = res.choices[0]?.message?.content
  return (typeof text === 'string' ? text : '').trim()
}

const CLASSIFIER_MODEL = process.env.OPENAI_CLASSIFIER_MODEL?.trim() || MAIN_CHAT_MODEL

const STAGES: CompanionConversationStage[] = ['open', 'hear', 'reflect', 'intervene', 'invite']

function coerceStage(raw: unknown): CompanionConversationStage {
  if (typeof raw === 'string' && STAGES.includes(raw as CompanionConversationStage))
    return raw as CompanionConversationStage
  return 'open'
}

function normalizeSession(raw?: Partial<CompanionSessionContext>): CompanionSessionContext {
  return {
    caregiverName: typeof raw?.caregiverName === 'string' ? raw.caregiverName.trim() : '',
    caregiverRole: typeof raw?.caregiverRole === 'string' ? raw.caregiverRole.trim() : '',
    emotionCheckIn: raw?.emotionCheckIn ?? null,
    lastActivity: raw?.lastActivity ?? null,
  }
}

function historyForApi(raw: CompanionHistoryItem[] | undefined): CompanionHistoryItem[] {
  if (!raw?.length) return []
  return raw.filter((h) => {
    const role = (h.role || '').trim()
    const c = typeof h.content === 'string' ? h.content.trim() : ''
    return (role === 'user' || role === 'assistant') && c.length > 0
  }) as CompanionHistoryItem[]
}

function conversationHistorySnippet(hist: CompanionHistoryItem[], maxLines = 20): string {
  if (!hist.length) return ''
  return hist
    .slice(-maxLines)
    .map((h) => `${h.role}: ${h.content}`)
    .join('\n')
}

function recentTwoTurnString(hist: CompanionHistoryItem[]): string {
  return hist.slice(-2).reduce((acc, h) => {
    const line = `${h.role}: ${h.content}`
    return acc ? `${acc}\n${line}` : line
  }, '')
}

/** Heuristic for very short hellos when the model JSON fails. */
function looksLikeBareGreeting(msg: string): boolean {
  const t = msg.trim()
  if (t.length > 48) return false
  return (
    /^(hi|hello|hey|hiya|good\s+(morning|afternoon|evening)|howdy)\b[!.,\s]*$/i.test(t) ||
    /^(hi|hello|hey)\b[!.,\s]+(there|cardea|team)\b[!.,\s]*$/i.test(t)
  )
}

function crisisAnswer(): string {
  return (
    `If you are in crisis, feel your life is in danger, or might hurt yourself or someone else, please reach out right away for professional help.` +
    ` Crisis Text Line: text HOME to 741741. 988 Lifeline (US): call or text 988. ` +
    `If there is immediate danger, call local emergency services. Cardea is not a therapist and cannot intervene in emergencies.`
  )
}

/** Assistant prose that points at emotion chips rendered below the message. */
const UI_CHIP_POINTER_RE =
  /\b(tags?|chips?|pills?|themes?|options|labels)\s+below\b|\bbelow[,]?\s*(you can |to )?(tap|see|pick|choose|check|explore)\b|\b(tap|see|check|pick|choose)\s+(what|which|any)\s+(fits|resonates|applies)\b|\bwhich\s+(tag|chip|theme)s?\s+fits\b/i

/** Assistant prose that points at an ExerciseCard rendered below the message. */
const UI_EXERCISE_POINTER_RE =
  /\b(exercise|practice|grounding|steps|card|micro-?practice)\s+below\b|\btry\s+the\s+(exercise|practice)\s+below\b/i

/** Assistant prose that points at a wellness tool card rendered below the message. */
const UI_TOOL_POINTER_RE =
  /\b(wellness\s+)?tool\s+below\b|\b(use|try|open)\s+(the\s+)?['"]?[\w\s-]+['"]?\s+tool\b/i

function answerReferencesEmotionChips(text: string): boolean {
  return UI_CHIP_POINTER_RE.test(text)
}

function answerReferencesExercise(text: string): boolean {
  return UI_EXERCISE_POINTER_RE.test(text)
}

function answerReferencesWellnessTool(text: string): boolean {
  return UI_TOOL_POINTER_RE.test(text) || /\bbelow\b[^\n.]{0,100}\b(guided\s+breathing|safe\s+place|grounding|name\s+it)\b/i.test(text)
}

function answerMentionsToolName(answer: string, toolName: string): boolean {
  const a = answer.toLowerCase()
  const n = toolName.toLowerCase()
  if (a.includes(n)) return true
  return /\b(wellness\s+tool|tool\s+card)\b/.test(a) && /\bbelow\b/.test(a)
}

/** When a tool card is attached, prose must name it — avoid a orphan link with no setup. */
function ensureWellnessToolMentioned(answer: string, tool: CompanionToolPayload): string {
  if (answerMentionsToolName(answer, tool.name)) return answer
  const raw = (tool.description ?? '').trim().replace(/\.$/, '')
  const lower = raw ? raw.charAt(0).toLowerCase() + raw.slice(1) : ''

  // Make the one-line blurb read naturally in a sentence without sounding pasted.
  let naturalTail = lower
  naturalTail = naturalTail.replace(/^use your\b/i, 'it uses your')
  naturalTail = naturalTail.replace(/^pick\b/i, 'it helps you pick')
  naturalTail = naturalTail.replace(/^a few words\b/i, 'it gives you a quick place to put a few words')
  naturalTail = naturalTail.replace(/^three\b/i, 'it offers three')
  naturalTail = naturalTail.replace(/^90 seconds of\b/i, "it’s about 90 seconds of")

  const suffix = naturalTail
    ? `The **${tool.name}** tool below can help — ${naturalTail}.`
    : `The **${tool.name}** tool below can help right now.`
  const trimmed = answer.trim()
  return trimmed ? `${trimmed.replace(/\s+$/, '')} ${suffix}` : suffix
}

function stripSentencesMatching(text: string, re: RegExp): string {
  const { shielded, markers } = shieldInlineCitations(text)
  const parts = shielded.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [shielded]
  const kept: string[] = []
  for (const part of parts) {
    const s = part.trim()
    if (!s || re.test(s)) continue
    kept.push(/[.!]$/.test(s) ? s : `${s}.`)
  }
  const out = kept.join(' ').trim()
  return out ? unshieldInlineCitations(out, markers) : ''
}

type CompanionUiAlignInput = {
  answer: string
  emotionChips: string[] | null
  exercise: CompanionExercisePayload | null
  toolCards?: CompanionToolPayload[] | null
  /** Chip labels available this turn (generated or attached). */
  availableChips?: string[]
}

/** Keep assistant copy aligned with chips / ExerciseCard / tool cards actually attached to the message. */
function alignCompanionUiPayload(input: CompanionUiAlignInput): CompanionUiAlignInput {
  let { answer, emotionChips, exercise, toolCards, availableChips } = input
  const chipsAvailable = (availableChips?.length ?? 0) > 0

  if (answerReferencesEmotionChips(answer)) {
    if (chipsAvailable) {
      emotionChips = emotionChips?.length ? emotionChips : availableChips!
    } else if (!emotionChips?.length) {
      answer = stripSentencesMatching(answer, UI_CHIP_POINTER_RE)
    }
  }

  if (answerReferencesExercise(answer) && !exercise) {
    answer = stripSentencesMatching(answer, UI_EXERCISE_POINTER_RE)
  }

  if (answerReferencesWellnessTool(answer) && !toolCards?.length) {
    answer = stripSentencesMatching(answer, UI_TOOL_POINTER_RE)
    answer = stripSentencesMatching(
      answer,
      /\b[^\n.]*\b(guided\s+breathing|safe\s+place|grounding|name\s+it|wellness\s+tool)[^\n.]*\bbelow\b[^\n.]*/i,
    )
  }

  return { answer, emotionChips, exercise, toolCards, availableChips }
}

async function classifyUserIntent(args: {
  message: string
  emotionCheckIn: string | null
  recentHistory: string
}): Promise<{ intent: ClassifierIntent; detectedEmotion: string | null; confidence: string }> {
  try {
    const res = await getLlmClient().chat.completions.create({
      model: resolveLlmModel(CLASSIFIER_MODEL),
      temperature: 0.05,
      max_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You only output valid compact JSON matching the user schema.' },
        {
          role: 'user',
          content: buildClassifierUser({
            message: args.message,
            emotionCheckIn: args.emotionCheckIn,
            recentHistory: args.recentHistory,
          }),
        },
      ],
    })
    const t = res.choices[0]?.message?.content
    if (!t) throw new Error('empty classifier')
    const parsed = JSON.parse(t) as {
      intent?: string
      detectedEmotion?: string | null
      confidence?: string
    }
    const intentRaw = parsed.intent
    const intents: ClassifierIntent[] = [
      'GREETING',
      'EMOTIONAL',
      'COPING_REQUEST',
      'INFORMATIONAL_RAG',
      'INFORMATIONAL_GLOSSARY',
      'INFORMATIONAL_CARE_TEAM',
      'INFORMATIONAL_SUPPORT',
      'HYBRID',
      'AMBIGUOUS',
    ]
    const intent = intents.includes(intentRaw as ClassifierIntent)
      ? (intentRaw as ClassifierIntent)
      : 'AMBIGUOUS'
    const detectedEmotion = safeDetectedEmotion(parsed.detectedEmotion)
    const confidence =
      parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
        ? parsed.confidence
        : 'medium'
    return { intent, detectedEmotion: detectedEmotion ?? null, confidence }
  } catch {
    if (looksLikeBareGreeting(args.message)) {
      return { intent: 'GREETING', detectedEmotion: null, confidence: 'low' }
    }
    return { intent: 'AMBIGUOUS', detectedEmotion: null, confidence: 'low' }
  }
}

function sessionToPrompt(s: CompanionSessionContext): SessionContextPrompt {
  return {
    caregiverName: s.caregiverName,
    caregiverRole: s.caregiverRole,
    emotionCheckIn: s.emotionCheckIn,
    lastActivity: s.lastActivity,
  }
}

function stageToPrompt(s: CompanionConversationStage): PromptConversationStage {
  return s as PromptConversationStage
}

function emotionalIntent(intent: ClassifierIntent): boolean {
  return intent === 'EMOTIONAL' || intent === 'AMBIGUOUS'
}

function intentToRedirect(intent: ClassifierIntent): CompanionUiRedirect | null {
  if (intent === 'INFORMATIONAL_CARE_TEAM') {
    return { label: 'Questions for your care team', destination: '?view=questions' }
  }
  if (intent === 'INFORMATIONAL_SUPPORT') {
    return { label: 'Support & community resources', destination: '?view=support' }
  }
  if (intent === 'INFORMATIONAL_GLOSSARY') {
    return { label: 'Medical glossary', destination: '?view=glossary' }
  }
  return null
}

function redirectToLegacy(r: CompanionUiRedirect | null): UiRedirect[] {
  if (!r) return []
  const path = r.destination.startsWith('/') ? r.destination : `/resources${r.destination}`
  let kind: UiRedirect['kind'] = 'glossary'
  if (r.destination.includes('questions')) kind = 'cardiologist_questions'
  else if (r.destination.includes('support')) kind = 'support_groups'
  return [{ kind, label: r.label, path, suggested: false, prominent: kind === 'cardiologist_questions' || kind === 'glossary' || kind === 'support_groups' }]
}

async function openAiMessages(
  messages: ChatCompletionMessageParam[],
  model: string,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const res = await getLlmClient().chat.completions.create({
    model: resolveLlmModel(model),
    messages,
    max_tokens: maxTokens,
    temperature,
  })
  const text = res.choices[0]?.message?.content
  return (typeof text === 'string' ? text : '').trim()
}

async function suggestFollowUps(userMessage: string, answerSansMissing: string): Promise<string[]> {
  try {
    const raw = await openAiChat(
      FOLLOWUP_SYSTEM,
      buildFollowupUserPrompt(userMessage, answerSansMissing),
      FOLLOWUP_CHAT_MODEL,
      350,
      0.6,
    )
    const out = parseFollowups(raw)
    return out.length > 0 ? out : parseFollowups('invalid')
  } catch {
    return parseFollowups('invalid')
  }
}

async function embedQuery(text: string): Promise<number[]> {
  const model = resolveLlmModel(process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small')
  const res = await getLlmClient().embeddings.create({ model, input: text })
  const v = res.data[0]?.embedding
  if (!v?.length) throw new Error('Empty embedding response')
  return v
}

function stripMissingBlock(answer: string): string {
  const i = answer.indexOf('[MISSING INFORMATION')
  if (i === -1) return answer
  return answer.slice(0, i).trimEnd()
}

function looksLikeWellnessToolLinksRequest(message: string): boolean {
  const n = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const hasWellness = /\bwellness\b/.test(n)
  const hasTooling = /\b(tool|tools|exercise|exercises|practice|practices)\b/.test(n)
  const asksToNavigate = /\b(link|links|url|urls|page|pages|route|routes|navigate|go to|open|where)\b/.test(n)
  const asksForAll = /\b(all|every|each|everything|whole|complete)\b/.test(n)

  // Example trigger:
  // - "Can you provide links to all of the wellness tools offered in this app?"
  // Also allow variations like "where can I find the wellness tool pages"
  return hasWellness && hasTooling && asksToNavigate && (asksForAll || /\bapp\b/.test(n) || /\boffer(ed)?\b/.test(n))
}

function buildAllWellnessToolCards(): CompanionToolPayload[] {
  return listAllWellnessToolsForChat()
}

function normalizeChipLabel(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function normalizeChipMatchKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function filterChipsAvoidingUserRepeat(message: string, chips: string[]): string[] {
  const msg = normalizeChipMatchKey(message)
  if (!msg) return chips
  return chips.filter((chip) => {
    const c = normalizeChipMatchKey(chip)
    if (!c) return false
    if (msg === c) return false
    if (msg.includes(c) && c.length >= 8) return false
    return true
  })
}

function parseEmotionChipsJson(raw: string): string[] {
  const trimmed = raw.trim()
  const jsonSlice = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed
  const parsed = JSON.parse(jsonSlice) as unknown
  let items: unknown[] | null = null
  if (Array.isArray(parsed)) items = parsed
  else if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>
    const candidate = o.chips ?? o.labels ?? o.options ?? o.themes
    if (Array.isArray(candidate)) items = candidate
  }
  if (!items) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    if (typeof item !== 'string') continue
    const label = normalizeChipLabel(item.slice(0, 80))
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    out.push(label)
    if (out.length >= 4) break
  }
  return out
}

/** Contextual underneath chips for HEAR — generated from the current user message only. */
async function generateEmotionChips(userMessage: string, retry = false): Promise<string[]> {
  try {
    const res = await getLlmClient().chat.completions.create({
      model: resolveLlmModel(MAIN_CHAT_MODEL),
      temperature: retry ? 0.25 : 0.4,
      max_tokens: 220,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You only output valid compact JSON matching the user schema.' },
        { role: 'user', content: buildEmotionChipGeneratorUser({ userMessage, retry }) },
      ],
    })
    const raw = res.choices[0]?.message?.content
    if (!raw) return []
    return parseEmotionChipsJson(raw)
  } catch {
    return []
  }
}

async function resolveHearEmotionChips(userMessage: string): Promise<string[]> {
  let chips = filterChipsAvoidingUserRepeat(userMessage, await generateEmotionChips(userMessage))
  if (chips.length < 3) {
    chips = filterChipsAvoidingUserRepeat(userMessage, await generateEmotionChips(userMessage, true))
  }
  return chips.slice(0, 4)
}

export async function runCompanionChat(req: CompanionChatRequest): Promise<CompanionChatResult> {
  const trimmed = req.message.trim()
  if (!trimmed) throw new Error('Empty message')

  const session = normalizeSession(req.sessionContext)
  const hist = historyForApi(req.history)
  const conversationStage = coerceStage(req.conversationStage)
  const inviteExerciseTitle = typeof req.inviteExerciseName === 'string' ? req.inviteExerciseName.trim() : ''
  const selectedEmotion = req.selectedEmotion ?? null
  const selectedUnderneath = req.selectedUnderneath ?? null
  const historyStr = conversationHistorySnippet(hist)
  // If the user explicitly asks for a coping tool, do not let stale invite/reflect
  // state swallow the request before it reaches the coping classifier branch.
  const forceCopingBranch = looksLikeCopingRequest(trimmed)

  if (detectCrisisKeywords(trimmed)) {
    const answer = crisisAnswer()
    const suggested = await suggestFollowUps(trimmed, answer)
    return {
      answer,
      nextStage: 'open',
      emotionChips: null,
      exercise: null,
      toolCards: null,
      uiRedirect: null,
      citations: [],
      suggestedQuestions: suggested,
      uiRedirects: [],
      retrieved: [],
      crisis: true,
      detectedEmotion: null,
      classifierIntent: 'CRISIS',
    }
  }

  // Deterministic shortcut: when the user asks for wellness tool links/pages/routes,
  // return a structured in-app navigation list (tool cards) instead of trying to
  // satisfy it through the RAG/informational prompt constraints.
  if (looksLikeWellnessToolLinksRequest(trimmed)) {
    const toolCards = buildAllWellnessToolCards()
    return {
      answer: 'Here are the wellness tools in the app. Tap a tool to open it.',
      nextStage: 'open',
      emotionChips: null,
      exercise: null,
      toolCards,
      uiRedirect: null,
      citations: [],
      suggestedQuestions: [],
      uiRedirects: [],
      retrieved: [],
      crisis: false,
      detectedEmotion: null,
      classifierIntent: 'TOOL_LINKS',
    }
  }

  if (conversationStage === 'invite' && !forceCopingBranch) {
    const nameHint =
      inviteExerciseTitle.length > 0
        ? `They just stepped through "${inviteExerciseTitle}" from the ExerciseCard. Do NOT say you're glad they tried anything, thank them for practicing, or open with gratitude. Tie the check-in to that title once if it reads naturally — e.g. "${inviteExerciseTitle} can stir a lot up — how did that land for you?" — or shorten to a single sincere question ("How did that feel?"). Warm prose in a few sentences; no bullet lists.`
        : 'They are checking in right after completing the guided practice from the prior turn (specific title unavailable). Same rules: no "glad" or "thanks for trying"; start straight into how it landed with one sincere question ("How did that feel?" etc.). Warm prose in a few sentences; no bullets.'
    const sys = buildCompanionSystem({
      session: sessionToPrompt(session),
      conversationHistory: historyStr,
      conversationStage: stageToPrompt('invite'),
      selectedEmotion,
      selectedUnderneath,
      branchHint: nameHint,
    })
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: sys },
      ...hist.map(
        (h): ChatCompletionMessageParam => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        }),
      ),
      { role: 'user', content: trimmed },
    ]
    let answer = polishCompanionEmotionalAnswer(
      await openAiMessages(messages, MAIN_CHAT_MODEL, 720, 0.45),
      trimmed,
    )
    const suggested = await suggestFollowUps(trimmed, stripMissingBlock(answer))
    ;({ answer } = alignCompanionUiPayload({ answer, emotionChips: null, exercise: null }))
    return {
      answer,
      nextStage: 'open',
      emotionChips: null,
      exercise: null,
      toolCards: null,
      uiRedirect: null,
      citations: [],
      suggestedQuestions: suggested,
      uiRedirects: [],
      retrieved: [],
      crisis: false,
      detectedEmotion: selectedEmotion,
      classifierIntent: null,
    }
  }

  const emotionMap = loadEmotionMap()

  if (conversationStage === 'reflect' && !forceCopingBranch) {
    const eid =
      safeDetectedEmotion(selectedEmotion) ??
      safeDetectedEmotion(session.emotionCheckIn) ??
      'unknown'
    const row =
      emotionMap.get(eid) ?? emotionMap.get('unknown')

    const underneath = selectedUnderneath?.trim() || row?.underneath || ''
    if (!row) {
      throw new Error('emotionMap.json missing fallback row unknown')
    }
    const selectedTool = toCompanionToolPayload(
      resolveSelectedTool(
        ...row.tools.map((tool) => tool.name),
        row.exercise.name,
        fallbackToolIdForEmotion(row.id),
      ),
    )
    const toolUiHint = selectedTool
      ? `TOOL CARD UI: One clickable wellness tool card for "${selectedTool.name}" WILL appear below — this opens the in-app tool (no step list in chat). If you mention an in-app tool in prose, ONLY name "${selectedTool.name}".`
      : 'TOOL CARD UI: Do NOT mention an in-app wellness tool or card below.'

    const sys = buildCompanionSystem({
      session: sessionToPrompt(session),
      conversationHistory: historyStr,
      conversationStage: stageToPrompt('reflect'),
      selectedEmotion: row.id,
      selectedUnderneath: underneath,
      branchHint:
        `They named what's underneath (${underneath}) while focused on emotion "${row.feeling}" (${row.id}). Modalities described as ${row.modalities.join(', ')} (${row.modalityReason}). Potential benefits clinicians note: ${row.benefits.join('; ')}. Validate their reality without stock phrases — paraphrase in plain language; do not quote their message back. ${toolUiHint} Write 2–3 short sentences: acknowledge what they named, then REQUIRED final sentence that names the wellness tool and points to the card below (e.g. "Open **${selectedTool?.name ?? 'the tool'}** below when you want to try it.").${selectedTool ? ` Use "${selectedTool.name}" exactly — no other in-app tool name. Do not mention a separate "feelings wheel".` : ''} Do NOT ask what steps they could take or what they need; do NOT ask permission to try it; do NOT list numbered steps in prose.`,
    })

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: sys },
      ...hist.map(
        (h): ChatCompletionMessageParam => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        }),
      ),
      { role: 'user', content: trimmed },
    ]
    let answer = polishCompanionEmotionalAnswer(
      await openAiMessages(messages, MAIN_CHAT_MODEL, 1100, 0.45),
      trimmed,
    )
    const suggested = await suggestFollowUps(trimmed, stripMissingBlock(answer))

    const toolCards = selectedTool ? [selectedTool] : null
    if (selectedTool) {
      answer = ensureWellnessToolMentioned(answer, selectedTool)
    }
    ;({ answer } = alignCompanionUiPayload({
      answer,
      emotionChips: null,
      exercise: null,
      toolCards,
    }))
    return {
      answer,
      nextStage: 'open',
      emotionChips: null,
      exercise: null,
      toolCards,
      uiRedirect: null,
      citations: [],
      suggestedQuestions: suggested,
      uiRedirects: [],
      retrieved: [],
      crisis: false,
      detectedEmotion: row.id,
      classifierIntent: null,
    }
  }

  const cls = await classifyUserIntent({
    message: trimmed,
    emotionCheckIn: session.emotionCheckIn,
    recentHistory: recentTwoTurnString(hist),
  })

  if (shouldUseCopingBranch(cls.intent, trimmed)) {
    const classifierEmotion = safeDetectedEmotion(cls.detectedEmotion)
    const checkinEm = safeDetectedEmotion(session.emotionCheckIn)
    const coping = matchCopingRequest(trimmed, classifierEmotion, checkinEm)
    const selectedTool = coping.selectedTool
    const toolUiHint = selectedTool
      ? `TOOL CARD UI: One clickable wellness tool card for "${selectedTool.name}" WILL appear below. If you mention an in-app tool in prose, ONLY name "${selectedTool.name}".`
      : 'TOOL CARD UI: Do NOT mention an in-app wellness tool or card below.'

    const sys = buildCompanionSystem({
      session: sessionToPrompt(session),
      conversationHistory: historyStr,
      conversationStage: stageToPrompt(conversationStage),
      selectedEmotion: coping.emotionId,
      selectedUnderneath: null,
      branchHint:
        `They asked for a specific calming practice or exercise (classifier=${cls.intent === 'COPING_REQUEST' ? 'COPING_REQUEST' : 'EMOTIONAL+heuristic'}). Skip emotion-map chips — go straight to the live in-app tool. ${toolUiHint} In 2 short sentences, acknowledge the stress briefly, then REQUIRED: name the wellness tool and point to the card below.${selectedTool ? ` Use "${selectedTool.name}" exactly and no other in-app tool name.` : ''} Do NOT mention steps below, an exercise card below, or numbered instructions in prose. Do NOT ask permission to try it; do NOT ask what is underneath or mention tags/chips below.`,
    })

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: sys },
      ...hist.map(
        (h): ChatCompletionMessageParam => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        }),
      ),
      { role: 'user', content: trimmed },
    ]
    let answer = polishCompanionEmotionalAnswer(
      await openAiMessages(messages, MAIN_CHAT_MODEL, 900, 0.42),
      trimmed,
    )
    const suggested = await suggestFollowUps(trimmed, stripMissingBlock(answer))

    const copingToolCards = selectedTool ? [selectedTool] : null
    if (selectedTool) {
      answer = ensureWellnessToolMentioned(answer, selectedTool)
    }
    ;({ answer } = alignCompanionUiPayload({
      answer,
      emotionChips: null,
      exercise: null,
      toolCards: copingToolCards,
    }))

    return {
      answer,
      nextStage: 'open',
      emotionChips: null,
      exercise: null,
      toolCards: copingToolCards,
      uiRedirect: null,
      citations: [],
      suggestedQuestions: suggested,
      uiRedirects: [],
      retrieved: [],
      crisis: false,
      detectedEmotion: coping.emotionId,
      classifierIntent: 'COPING_REQUEST',
    }
  }

  const inChipStages =
    conversationStage === 'open' ||
    conversationStage === 'hear' ||
    conversationStage === 'intervene'

  if (inChipStages && cls.intent === 'GREETING') {
    const sys = buildCompanionSystem({
      session: sessionToPrompt(session),
      conversationHistory: historyStr,
      conversationStage: stageToPrompt(conversationStage),
      selectedEmotion: null,
      selectedUnderneath: null,
      branchHint:
        `They sent a greeting or salutation (classifier GREETING). Respond warmly — two or three sentences — like a teammate who is genuinely glad they're here. No crisis or survival-mode vibes; nothing about overwhelm or overload; do not steer toward emotion-map chips or heavy probing. Invite them softly to share when ready; keep it light until they bring substance.`,
    })
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: sys },
      ...hist.map(
        (h): ChatCompletionMessageParam => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        }),
      ),
      { role: 'user', content: trimmed },
    ]
    let answer = await openAiMessages(messages, MAIN_CHAT_MODEL, 580, 0.35)
    const suggested = await suggestFollowUps(trimmed, stripMissingBlock(answer))
    ;({ answer } = alignCompanionUiPayload({ answer, emotionChips: null, exercise: null }))
    return {
      answer,
      nextStage: 'open',
      emotionChips: null,
      exercise: null,
      toolCards: null,
      uiRedirect: null,
      citations: [],
      suggestedQuestions: suggested,
      uiRedirects: [],
      retrieved: [],
      crisis: false,
      detectedEmotion: null,
      classifierIntent: 'GREETING',
    }
  }

  if (cls.intent === 'HYBRID') {
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

    const classifierEmotion = safeDetectedEmotion(cls.detectedEmotion)
    const checkinEm = safeDetectedEmotion(session.emotionCheckIn)
    const emotionId = classifierEmotion ?? checkinEm ?? 'unknown'

    const hybridSys = buildHybridUnifiedSystem({
      session: sessionToPrompt(session),
      conversationHistory: historyStr,
      knowledgeContextBlock: contextBlock,
      userMessage: trimmed,
    })
    const hybridMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: hybridSys },
      ...hist.map(
        (h): ChatCompletionMessageParam => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        }),
      ),
      { role: 'user', content: trimmed },
    ]
    const hybridRaw = await openAiMessages(hybridMessages, MAIN_CHAT_MODEL, 580, 0.32)
    const { emotional: emoBlock, informational: infoBlock, closing: closingBlock } =
      splitHybridAnswer(hybridRaw)
    const emotionalPara = clipWordsAtSentence(
      polishHybridEmotionalParagraph(emoBlock, trimmed),
      HYBRID_EMOTION_MAX_WORDS,
    )
    const informationalPara = polishInformationalAnswer(infoBlock, trimmed, {
      includeFollowUp: false,
      maxBodyWords: HYBRID_INFO_MAX_WORDS,
    })
    let closingPara = polishHybridClosing(closingBlock)
    if (!closingPara) closingPara = fallbackHybridClosing(trimmed)
    let answer = [emotionalPara, informationalPara, closingPara].filter(Boolean).join('\n\n').trim()
    ;({ answer } = alignCompanionUiPayload({ answer, emotionChips: null, exercise: null }))
    const citations: ChatCitation[] = retrieved.map((r) => ({
      chunkId: r.id,
      title: r.title,
      sourceUrl: r.sourceUrl,
      excerpt: clip(r.text, 220),
    }))
    const suggestedQuestions = await suggestFollowUps(trimmed, stripMissingBlock(answer))

    return {
      answer,
      nextStage: 'open',
      emotionChips: null,
      exercise: null,
      toolCards: null,
      uiRedirect: null,
      citations,
      suggestedQuestions,
      uiRedirects: [],
      retrieved,
      crisis: false,
      detectedEmotion: emotionId,
      classifierIntent: 'HYBRID',
    }
  }

  const informationalBranch = !emotionalIntent(cls.intent)

  if (!informationalBranch && inChipStages) {
    const classifierEmotion = safeDetectedEmotion(cls.detectedEmotion)
    const checkinEm = safeDetectedEmotion(session.emotionCheckIn)
    const emotionId = classifierEmotion ?? checkinEm ?? 'unknown'
    const row = emotionMap.get(emotionId) ?? emotionMap.get('unknown')

    const chipGenPromise = resolveHearEmotionChips(trimmed)

    const sys = buildCompanionSystem({
      session: sessionToPrompt(session),
      conversationHistory: historyStr,
      conversationStage: stageToPrompt(conversationStage),
      selectedEmotion: null,
      selectedUnderneath: null,
      branchHint: `They're sharing emotionally (classifier=${cls.intent}). Write like a calm, specific human — not a therapy script. Do NOT open by restating their message ("You're feeling X and Y…"). Start with a fresh sentence about what this moment is like for a parent. Mention today's check-in (${session.emotionCheckIn ?? 'none'}) only if it fits naturally.

CHIP UI: 3–4 tap-to-choose tags tailored to their message WILL appear directly below your reply (you do not write the labels). You may add one short line pointing to the tags below (e.g. "tap what fits below") — do not list specific tag text in prose.

NO TOOL OR EXERCISE UI this turn: Do NOT mention any in-app wellness tool, Guided Breathing, Safe Place, grounding tool, or anything "below" except the tag row. Tools and exercises come after they tap a tag.

SHAPE THIS REPLY (vary from prior turns in CONVERSATION HISTORY):
- 2–4 short paragraphs; no fixed template. Often 2–3 is enough.
- Include at most: one grounded acknowledgment, OR one concrete coping idea as a statement, OR one line pointing to the tags below — pick what helps this message; skip what sounds canned.
- Do NOT ask what small steps they could take. Do NOT use "wondering what's underneath" questions — pills handle that.`,
    })

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: sys },
      ...hist.map(
        (h): ChatCompletionMessageParam => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        }),
      ),
      {
        role: 'user',
        content: trimmed,
      },
    ]

    const [answerRaw, generatedChips] = await Promise.all([
      openAiMessages(messages, MAIN_CHAT_MODEL, 1000, 0.44),
      chipGenPromise,
    ])

    let answer = polishCompanionEmotionalAnswer(answerRaw, trimmed)

    const suggested = await suggestFollowUps(trimmed, stripMissingBlock(answer))

    let chips = generatedChips.length > 0 ? generatedChips : null
    ;({ answer, emotionChips: chips } = alignCompanionUiPayload({
      answer,
      emotionChips: chips,
      exercise: null,
      toolCards: null,
      availableChips: chips ?? undefined,
    }))

    return {
      answer,
      nextStage: 'hear',
      emotionChips: chips,
      exercise: null,
      toolCards: null,
      uiRedirect: null,
      citations: [],
      suggestedQuestions: suggested,
      uiRedirects: [],
      retrieved: [],
      crisis: false,
      detectedEmotion: emotionId,
      classifierIntent: cls.intent,
    }
  }

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

  let extraHint = `User message:\n${trimmed}\n\nKnowledge context:\n${contextBlock}`
  const primaryRedirect = intentToRedirect(cls.intent)
  if (primaryRedirect) {
    extraHint += `\n\nAlso mention (in prose only) there is an in-app shortcut: "${primaryRedirect.label}" → ${primaryRedirect.destination}.`
  }

  const sysInformational = buildInformationalRagSystem({
    session: sessionToPrompt(session),
    conversationHistory: historyStr,
    extraHint,
  })

  const rawInformational = await openAiChat(
    sysInformational,
    [
      trimmed,
      'Part 1: exactly ONE paragraph, 85–160 words, no question marks. REQUIRED: include at least one inline citation [1], [2], … after excerpt-backed claims in part 1 (numbers match the knowledge excerpts). Part 2 after a blank line: one follow-up question — use parentheses for topics, not [brackets].',
    ].join('\n'),
    MAIN_CHAT_MODEL,
    430,
    0.28,
  )
  const answer = polishInformationalAnswer(rawInformational, trimmed)

  const citations: ChatCitation[] = retrieved.map((r) => ({
    chunkId: r.id,
    title: r.title,
    sourceUrl: r.sourceUrl,
    excerpt: clip(r.text, 220),
  }))

  const suggestedQuestions = await suggestFollowUps(trimmed, stripMissingBlock(answer))
  const uiRedirectsOnlyIntent = redirectToLegacy(primaryRedirect)

  return {
    answer,
    nextStage: 'open',
    emotionChips: null,
    exercise: null,
    toolCards: null,
    /** Same intent shortcut is already in `uiRedirects` — omit duplicate dashed button in the client. */
    uiRedirect: null,
    citations,
    suggestedQuestions,
    uiRedirects: uiRedirectsOnlyIntent,
    retrieved,
    crisis: false,
    detectedEmotion: cls.detectedEmotion,
    classifierIntent: cls.intent,
  }
}

const WELCOME_EMBED_QUERY =
  'Caregiver stress emotional support families congenital heart disease CHD coping worry uncertainty grief fatigue pediatric heart navigating care'

const WELCOME_TOP_K = 7
const WELCOME_MAX_TOKENS = 720

/**
 * First-screen welcome copy for Chat: retrieval + warm trauma-informed / CBT-structured opener
 * grounded in the knowledge corpus (not a generic static greeting).
 */
export async function runWelcomeMessage(): Promise<string> {
  const items = await loadKnowledgeIndex()
  if (items.length === 0) {
    const hint = getKnowledgeLoadError()
    throw new Error(`Knowledge index unavailable${hint ? `: ${hint}` : ''}. Run: npm run rag:build`)
  }
  const qEmb = await embedQuery(WELCOME_EMBED_QUERY)
  const retrieved = embedQueryToScores(qEmb, items, WELCOME_TOP_K)
  const forPrompt = retrieved.map((r) => ({
    title: r.title,
    sourceUrl: r.sourceUrl,
    text: clip(r.text, CHUNK_CHAR_BUDGET),
  }))
  const contextBlock = buildKnowledgeContextBlock(forPrompt)
  const system = buildWelcomeOpenerSystem()
  const user = buildWelcomeOpenerUser(contextBlock)
  const text = await openAiChat(system, user, MAIN_CHAT_MODEL, WELCOME_MAX_TOKENS, 0.52)
  const trimmed = (text || '').trim()
  if (!trimmed) throw new Error('empty welcome response')
  return trimmed
}

/** Legacy helper: ignores companion fields; callers should prefer `runCompanionChat`. */
export async function runKbChat(userMessage: string): Promise<KbChatResult> {
  const out = await runCompanionChat({
    message: userMessage,
    history: [],
    conversationStage: 'open',
    selectedEmotion: null,
    selectedUnderneath: null,
    sessionContext: {},
  })

  const { nextStage: _ns, emotionChips: _ec, exercise: _ex, toolCards: _tc, uiRedirect: _ur, crisis: _c, detectedEmotion: _de, classifierIntent: _ci, ...legacy } =
    out
  return legacy
}
