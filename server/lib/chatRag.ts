import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js'
import {
  buildFollowupUserPrompt,
  buildKnowledgeContextBlock,
  FOLLOWUP_SYSTEM,
} from '../prompts/kbChat.js'
import {
  buildClassifierUser,
  buildCompanionSystem,
  buildInformationalRagSystem,
  buildWelcomeOpenerSystem,
  buildWelcomeOpenerUser,
  type ClassifierIntent,
  type ConversationStage as PromptConversationStage,
  type SessionContextPrompt,
} from '../prompts/companionPrompts.js'
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

async function openAiChat(
  system: string,
  user: string,
  model: string,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const res = await getOpenAI().chat.completions.create({
    model,
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

const CRISIS_RE =
  /\b(suicid|suicide|kill myself|killing myself|end\s+my\s+life|want\s+to\s+die|don'?t\s+want\s+to\s+live|hurt\s+myself|self[\s-]?harm|hurt\s+others)\b/i

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
    const res = await getOpenAI().chat.completions.create({
      model: CLASSIFIER_MODEL,
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
  return intent === 'EMOTIONAL' || intent === 'HYBRID' || intent === 'AMBIGUOUS'
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
  const res = await getOpenAI().chat.completions.create({
    model,
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
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small'
  const res = await getOpenAI().embeddings.create({ model, input: text })
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

  if (CRISIS_RE.test(trimmed)) {
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
    const answer = await openAiMessages(messages, MAIN_CHAT_MODEL, 550, 0.45)
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
        `They named what's underneath (${underneath}) while focused on emotion "${row.feeling}" (${row.id}). Modalities described as ${row.modalities.join(', ')} (${row.modalityReason}). Potential benefits clinicians note: ${row.benefits.join('; ')}. Validate their reality without stock phrases — use their wording. Invite the paired micro-practice with one grounded sentence only; do NOT ask permission to try it; do NOT list numbered steps in prose (the ExerciseCard shows steps). Mention the exercise title naturally if it's one short clause.`,
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
    const answer = await openAiMessages(messages, MAIN_CHAT_MODEL, 900, 0.45)
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
      branchHint: `They're sharing emotionally (classifier=${cls.intent}). First line: reuse their emotion words verbatim if they named any ("scared and stressed", etc.). Acknowledge plainly in a calm, therapist-like register — contained warmth, no pep talk. Mention today's check-in (${session.emotionCheckIn ?? 'none'}) only when it genuinely fits.

CHIP ROW (reference for YOU only — rendered as separate tap pills under this reply). Do NOT paste, quote, comma-list, or re-ask these themes in your message; the UI already shows them. Users should not read the same inventory twice.
${chipBlock}

ANTI-REPETITION (critical):
- Use 2–3 short paragraphs total.
- Paragraph 1–2: reflect their reality; optionally offer one gentle wondering sentence about what might be underneath the feeling (sensations, stakes, fears) — **without** a multiple-choice pattern (no "is it A, B, or C?" and do not name categories that mirror the chip line items: appointments, medications, logistics, information, responsibilities, worry, etc.).
- Final paragraph: **one** short sentence that only points at the tap row — e.g. ask which option below fits best, or invite them to type their own words. Do not enumerate or paraphrase the chip strings in prose.
- Never stack two questions that probe the same "what's underneath" lane (e.g. no "what makes this heavy — logistics vs information?" followed by "which option: appointments, meds…").`,
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

    const answer = await openAiMessages(messages, MAIN_CHAT_MODEL, 750, 0.38)

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

  const answer = await openAiChat(
    sysInformational,
    [
      trimmed,
      'Reply in prose paragraphs referencing [1],[2],… labels only where supported by those excerpts.',
    ].join('\n'),
    MAIN_CHAT_MODEL,
    1200,
    0.3,
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
