import { loadEmotionMap, safeDetectedEmotion } from './emotionMapLoader.js'

export type CopingExercisePayload = { name: string; steps: string[] }
export type CopingToolPayload = { name: string; route: string }

export type CopingMatch = {
  exercise: CopingExercisePayload
  tools: CopingToolPayload[]
  emotionId: string
}

/** Distress venting without asking for a specific practice or tool. */
const VENTING_ONLY_RE =
  /\b(?:freaking\s+out|panicking|having\s+a\s+panic|panic\s+attack|spiraling|melting\s+down|losing\s+it|falling\s+apart|can'?t\s+breathe|cannot\s+breathe)\b/i

/** Medical-sounding breath distress without an explicit coping ask — stay on emotional path. */
const MEDICAL_BREATH_DISTRESS_RE =
  /\b(?:can'?t|cannot)\s+breathe\b/i

const EXPLICIT_COPING_ASK_RE =
  /\b(?:help\s+me|need\s+(?:a\s+|an\s+)?|want\s+(?:a\s+|an\s+)?|give\s+me|walk\s+me\s+through|guide\s+me\s+(?:through|with)|can\s+you\s+(?:help|guide|walk)|show\s+me|lead\s+me\s+through|i\s+need\s+to)\b/i

const DIRECT_COPING_RE =
  /\b(?:breathing\s+exercise|box\s+breathing|4-7-8|physiological\s+sigh|grounding\s+exercise|5-4-3-2-1|body\s+scan|safe\s+place|calm(?:\s+me)?\s+down|help\s+me\s+calm|slow\s+my\s+breathing|breathe\s+with\s+me)\b/i

const BREATHING_RE = /\b(?:breathing\s+exercise|box\s+breathing|4-7-8|physiological\s+sigh|guided\s+breathing|slow\s+(?:my\s+)?breathing|breathe\s+(?:with\s+me|slower|slowly)|breath\s+work)\b/i
const GROUNDING_RE = /\b(?:grounding|5-4-3-2-1|ground\s+me)\b/i
const SAFE_PLACE_RE = /\b(?:safe\s+place|visualization)\b/i
const BODY_SCAN_RE = /\b(?:body\s+scan|body\s+check-?in)\b/i
const CALM_RE = /\b(?:calm(?:\s+me)?\s+down|help\s+me\s+calm|need\s+to\s+calm)\b/i
const STOP_RE = /\b(?:stop\s+skill|dbt\s+stop)\b/i

const BOX_BREATHING: CopingExercisePayload = {
  name: 'Box Breathing',
  steps: [
    'Breathe in through your nose for 4 counts.',
    'Hold gently for 4 counts.',
    'Breathe out through your mouth for 4 counts.',
    'Hold empty for 4 counts, then repeat 3–4 rounds.',
  ],
}

function rowToMatch(emotionId: string): CopingMatch | null {
  const row = loadEmotionMap().get(emotionId)
  if (!row) return null
  return {
    emotionId: row.id,
    exercise: { name: row.exercise.name, steps: [...row.exercise.steps] },
    tools: row.tools.map((t) => ({ name: t.name, route: t.route })),
  }
}

function breathingMatch(): CopingMatch {
  const anxious = rowToMatch('anxious')
  return {
    emotionId: 'anxious',
    exercise: BOX_BREATHING,
    tools: anxious?.tools.length
      ? anxious.tools
      : [{ name: 'Guided breathing', route: '/wellness' }],
  }
}

function pickByKeywords(normalized: string): CopingMatch | null {
  if (BREATHING_RE.test(normalized)) return breathingMatch()
  if (GROUNDING_RE.test(normalized)) return rowToMatch('anxious') ?? breathingMatch()
  if (SAFE_PLACE_RE.test(normalized)) return rowToMatch('scared') ?? rowToMatch('anxious')
  if (BODY_SCAN_RE.test(normalized)) return rowToMatch('numb') ?? rowToMatch('anxious')
  if (STOP_RE.test(normalized)) return rowToMatch('angry') ?? rowToMatch('anxious')
  if (CALM_RE.test(normalized)) return rowToMatch('anxious') ?? breathingMatch()
  return null
}

export function looksLikeVentingOnly(message: string): boolean {
  const n = message.toLowerCase().replace(/\s+/g, ' ').trim()
  const distress =
    VENTING_ONLY_RE.test(n) ||
    (MEDICAL_BREATH_DISTRESS_RE.test(n) && !EXPLICIT_COPING_ASK_RE.test(n) && !DIRECT_COPING_RE.test(n))
  if (!distress) return false
  return !EXPLICIT_COPING_ASK_RE.test(n) && !DIRECT_COPING_RE.test(n)
}

/** Heuristic backup when the classifier labels EMOTIONAL but the user asked for a concrete practice. */
export function looksLikeCopingRequest(message: string): boolean {
  const n = message.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!n || looksLikeVentingOnly(message)) return false
  if (MEDICAL_BREATH_DISTRESS_RE.test(n) && !EXPLICIT_COPING_ASK_RE.test(n) && !DIRECT_COPING_RE.test(n)) {
    return false
  }
  if (DIRECT_COPING_RE.test(n)) return true
  if (
    EXPLICIT_COPING_ASK_RE.test(n) &&
    /\b(?:calm|breath|breathe|ground(?:ing)?|relax|meditat|exercise|practice|tool)\b/i.test(n)
  ) {
    return true
  }
  return false
}

export function matchCopingRequest(
  message: string,
  detectedEmotion: string | null,
  emotionCheckIn: string | null,
): CopingMatch {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim()
  const byKeyword = pickByKeywords(normalized)
  if (byKeyword) return byKeyword

  const emotionId =
    safeDetectedEmotion(detectedEmotion) ?? safeDetectedEmotion(emotionCheckIn) ?? 'anxious'
  const fromMap = rowToMatch(emotionId) ?? rowToMatch('anxious')
  if (fromMap) return fromMap

  return breathingMatch()
}

export function shouldUseCopingBranch(intent: string, message: string): boolean {
  if (intent === 'COPING_REQUEST') return true
  if (intent === 'EMOTIONAL' || intent === 'AMBIGUOUS') {
    return looksLikeCopingRequest(message) && !looksLikeVentingOnly(message)
  }
  return false
}
