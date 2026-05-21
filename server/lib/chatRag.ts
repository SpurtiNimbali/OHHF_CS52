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
  buildHybridUnifiedSystem,
  buildInformationalRagSystem,
  buildWelcomeOpenerSystem,
  buildWelcomeOpenerUser,
  type ClassifierIntent,
  type ConversationStage as PromptConversationStage,
  type SessionContextPrompt,
} from '../prompts/companionPrompts.js'
import { detectCrisisKeywords } from '../../src/lib/crisisKeywords.js'
import { loadEmotionMap, safeDetectedEmotion, splitUnderneathIntoChipOptions } from './emotionMapLoader.js'
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
export type CompanionToolPayload = { name: string; route: string }
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

function clip(s: string, n: number): string {
  const t = s.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n)}…`
}

const HYBRID_EMOTION_MAX_WORDS = 70
const HYBRID_INFO_MAX_WORDS = 100
/** Standalone informational RAG (non-hybrid) word cap. */
const INFO_RAG_MAX_WORDS = 100

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

/** Remove questions and UI-pointer sentences from hybrid body paragraphs. */
function polishHybridParagraph(text: string): string {
  let t = text.trim()
  const mi = t.indexOf('[MISSING INFORMATION')
  if (mi !== -1) t = t.slice(0, mi).trimEnd()

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
    if (/resources below|options below|tap below|chips below/i.test(s)) continue
    kept.push(/[.!]$/.test(s) ? s : `${s}.`)
  }
  return kept.join(' ').trim()
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

/** Body capped at 50–100 words; optional follow-up question after (not capped). */
function polishInformationalAnswer(
  text: string,
  userMessage: string,
  opts?: { includeFollowUp?: boolean },
): string {
  const includeFollowUp = opts?.includeFollowUp !== false
  const { body, followUp } = splitInformationalFollowUp(text)
  let b = polishHybridInformationalParagraph(polishHybridParagraph(body), userMessage)
  b = b.replace(/\n\s*\n+/g, ' ').replace(/\s+/g, ' ').trim()
  b = clipWordsAtSentence(b, INFO_RAG_MAX_WORDS)
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
    `If you are in crisis or might hurt yourself or someone else, please reach out right away for professional help.` +
    ` Crisis Text Line: text HOME to 741741. 988 Lifeline (US): call or text 988. ` +
    `If there is immediate danger, call local emergency services. Cardea is not a therapist and cannot intervene in emergencies.`
  )
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

  if (conversationStage === 'invite') {
    const nameHint =
      inviteExerciseTitle.length > 0
        ? `They just stepped through "${inviteExerciseTitle}" from the ExerciseCard. Do NOT say you're glad they tried anything, thank them for practicing, or open with gratitude. Tie the check-in to that title once if it reads naturally — e.g. "${inviteExerciseTitle} can stir a lot up — how did that land for you?" — or shorten to a single sincere question ("How did that feel?"). Brief warm prose only; no bullet lists.`
        : 'They are checking in right after completing the guided practice from the prior turn (specific title unavailable). Same rules: no "glad" or "thanks for trying"; start straight into how it landed with one sincere question ("How did that feel?" etc.). Warm prose only; no bullets.'
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
    const answer = polishCompanionEmotionalAnswer(
      await openAiMessages(messages, MAIN_CHAT_MODEL, 550, 0.45),
      trimmed,
    )
    const suggested = await suggestFollowUps(trimmed, stripMissingBlock(answer))
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

  if (conversationStage === 'reflect') {
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

    const sys = buildCompanionSystem({
      session: sessionToPrompt(session),
      conversationHistory: historyStr,
      conversationStage: stageToPrompt('reflect'),
      selectedEmotion: row.id,
      selectedUnderneath: underneath,
      branchHint:
        `They named what's underneath (${underneath}) while focused on emotion "${row.feeling}" (${row.id}). Modalities described as ${row.modalities.join(', ')} (${row.modalityReason}). Potential benefits clinicians note: ${row.benefits.join('; ')}. Validate their reality without stock phrases — paraphrase in plain language; do not quote their message back. In one grounded sentence, name the micro-practice below ("${row.exercise.name}") and what it helps with — do NOT ask what steps they could take or what they need; do NOT ask permission to try it; do NOT list numbered steps in prose (the ExerciseCard shows steps).`,
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
    const answer = polishCompanionEmotionalAnswer(
      await openAiMessages(messages, MAIN_CHAT_MODEL, 900, 0.45),
      trimmed,
    )
    const suggested = await suggestFollowUps(trimmed, stripMissingBlock(answer))

    const exercisePayload: CompanionExercisePayload = {
      name: row.exercise.name,
      steps: [...row.exercise.steps],
    }
    const tools: CompanionToolPayload[] = row.tools.map((t) => ({
      name: t.name,
      route: t.route,
    }))

    return {
      answer,
      nextStage: 'invite',
      emotionChips: null,
      exercise: exercisePayload,
      toolCards: tools.length ? tools : null,
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
        `They sent a greeting or salutation (classifier GREETING). Respond warmly and briefly — one or two short sentences — like a teammate who is genuinely glad they're here. No crisis or survival-mode vibes; nothing about overwhelm or overload; do not steer toward emotion-map chips or heavy probing. Invite them softly to share when ready; keep it light until they bring substance.`,
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
    const answer = await openAiMessages(messages, MAIN_CHAT_MODEL, 450, 0.35)
    const suggested = await suggestFollowUps(trimmed, stripMissingBlock(answer))
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
    const informationalPara = polishInformationalAnswer(infoBlock, trimmed, { includeFollowUp: false })
    let closingPara = polishHybridClosing(closingBlock)
    if (!closingPara) closingPara = fallbackHybridClosing(trimmed)
    const answer = [emotionalPara, informationalPara, closingPara].filter(Boolean).join('\n\n').trim()
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

    const chipOptions = row?.underneath ? splitUnderneathIntoChipOptions(row.underneath) : []
    const chipBlock =
      chipOptions.length > 0
        ? chipOptions.map((c, i) => `${i + 1}. ${c}`).join('\n')
        : '(none — invite them to name what is underneath in their own words)'

    const sys = buildCompanionSystem({
      session: sessionToPrompt(session),
      conversationHistory: historyStr,
      conversationStage: stageToPrompt(conversationStage),
      selectedEmotion: null,
      selectedUnderneath: null,
      branchHint: `They're sharing emotionally (classifier=${cls.intent}). Write like a calm, specific human — not a therapy script. Do NOT open by restating their message ("You're feeling X and Y…"). Start with a fresh sentence about what this moment is like for a parent. Mention today's check-in (${session.emotionCheckIn ?? 'none'}) only if it fits naturally.

CHIP ROW (for UI only — do not list these themes in prose):
${chipBlock}

SHAPE THIS REPLY (vary from prior turns in CONVERSATION HISTORY):
- 1–3 short paragraphs; no fixed template. Often 2 is enough.
- Include at most: one grounded acknowledgment, OR one concrete coping idea as a statement, OR one line pointing to the pills below — pick what helps this message; skip what sounds canned.
- Do NOT ask what small steps they could take. Do NOT use "wondering what's underneath" questions — pills handle that.
- If you point to the row below, one casual sentence max (wording can vary: "see which tag fits", "tap what resonates", etc.).`,
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

    const answer = polishCompanionEmotionalAnswer(
      await openAiMessages(messages, MAIN_CHAT_MODEL, 750, 0.44),
      trimmed,
    )

    const suggested = await suggestFollowUps(trimmed, stripMissingBlock(answer))

    const chips = chipOptions.length > 0 ? chipOptions : null

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

  const answer = polishInformationalAnswer(
    await openAiChat(
      sysInformational,
      [
        trimmed,
        'Part 1: exactly ONE paragraph, 50–100 words, no question marks. Part 2 after a blank line: one follow-up question (e.g. would you like to know more about X or Y). Use [1],[2],… only where excerpts support part 1.',
      ].join('\n'),
      MAIN_CHAT_MODEL,
      240,
      0.28,
    ),
    trimmed,
  )

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
const WELCOME_MAX_TOKENS = 520

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
