export type WellnessToolId =
  | 'breathing'
  | 'grounding'
  | 'physical-regulation'
  | 'name-it'
  | 'micro-journal'
  | 'reframes'
  | 'safe-place'
  | 'today-nudge'
  | 'crisis-reset'

export type ResolvedWellnessTool = {
  id: WellnessToolId
  label: string
  route: string
  description: string
}

/** Hardcoded internal paths — single source of truth for chat tool cards and deep links. */
export const WELLNESS_TOOL_ROUTE_MAP: Record<WellnessToolId, string> = {
  'safe-place': '/wellness?tool=safe-place',
  breathing: '/wellness?tool=breathing',
  'micro-journal': '/wellness?tool=micro-journal',
  reframes: '/wellness?tool=reframes',
  grounding: '/wellness?tool=grounding',
  'physical-regulation': '/wellness?tool=physical-regulation',
  'today-nudge': '/wellness?tool=today-nudge',
  'name-it': '/wellness?tool=name-it',
  'crisis-reset': '/wellness?tool=crisis-reset',
}

export const WELLNESS_TOOL_LABELS: Record<WellnessToolId, string> = {
  'safe-place': 'Safe Place Visualization',
  breathing: 'Guided breathing',
  'micro-journal': 'Micro-journal',
  reframes: 'Reframes',
  grounding: '5-4-3-2-1 Grounding',
  'physical-regulation': 'Physical regulation',
  'today-nudge': "Today's Nudge",
  'name-it': 'Name It to Tame It',
  'crisis-reset': 'Crisis support',
}

/** One-line blurbs for chat tool listings and similar surfaces. */
export const WELLNESS_TOOL_DESCRIPTIONS: Record<WellnessToolId, string> = {
  'safe-place': '90 seconds of steadiness through a calming mental image.',
  breathing: 'Three calming breath patterns to settle your nervous system.',
  'micro-journal': 'A few words on how you are feeling.',
  reframes: 'Gently shift toward a kinder, more realistic thought.',
  grounding: 'Use your senses to come back to the present.',
  'physical-regulation': 'Cold reset, movement, or a body scan to regulate your body.',
  'today-nudge': 'One small connection cue you can try today.',
  'name-it': 'Pick precise feeling words to tame emotional intensity.',
  'crisis-reset': 'Guided reset plus crisis resources if you need help now.',
}

/** Display order when the chatbot lists every wellness tool. */
export const ALL_WELLNESS_TOOL_IDS: WellnessToolId[] = [
  'safe-place',
  'breathing',
  'micro-journal',
  'reframes',
  'grounding',
  'physical-regulation',
  'today-nudge',
  'name-it',
  'crisis-reset',
]

export type WellnessToolChatCard = {
  name: string
  route: string
  description: string
}

export function toWellnessToolChatCard(tool: ResolvedWellnessTool): WellnessToolChatCard {
  return {
    name: tool.label,
    route: buildToolRoute(tool.id),
    description: tool.description,
  }
}

export function listAllWellnessToolsForChat(): WellnessToolChatCard[] {
  return ALL_WELLNESS_TOOL_IDS.map((id) => toWellnessToolChatCard(resolveWellnessToolById(id)))
}

function resolveWellnessToolById(id: WellnessToolId): ResolvedWellnessTool {
  return {
    id,
    label: WELLNESS_TOOL_LABELS[id],
    route: buildToolRoute(id),
    description: WELLNESS_TOOL_DESCRIPTIONS[id],
  }
}

/** Mood/home suggested tools (excludes crisis — surfaced separately on wellness page). */
export const LIVE_MOOD_TOOL_IDS = [
  'breathing',
  'grounding',
  'physical-regulation',
  'name-it',
  'micro-journal',
  'reframes',
  'safe-place',
  'today-nudge',
] as const satisfies readonly WellnessToolId[]

export type LiveMoodWellnessToolId = (typeof LIVE_MOOD_TOOL_IDS)[number]

export const LIVE_TOOL_ALLOWLIST = LIVE_MOOD_TOOL_IDS.map((id) => ({
  id,
  label: WELLNESS_TOOL_LABELS[id],
  route: WELLNESS_TOOL_ROUTE_MAP[id],
  description: WELLNESS_TOOL_DESCRIPTIONS[id],
})) satisfies readonly ResolvedWellnessTool[]

export const WELLNESS_TOOL_REGISTRY = Object.fromEntries(
  (Object.keys(WELLNESS_TOOL_ROUTE_MAP) as WellnessToolId[]).map((id) => [
    id,
    { id, label: WELLNESS_TOOL_LABELS[id], route: WELLNESS_TOOL_ROUTE_MAP[id] },
  ]),
) as Record<WellnessToolId, ResolvedWellnessTool>

function normalizeToolKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const BLOCKED_TOOL_KEYS = new Set(
  ['stop-skill', 'stop skill', 'night-reset', 'night reset', 'be the parent'].map(normalizeToolKey),
)

const TOOL_ALIAS_TO_ID = new Map<string, WellnessToolId>()

for (const tool of Object.values(WELLNESS_TOOL_REGISTRY)) {
  TOOL_ALIAS_TO_ID.set(normalizeToolKey(tool.id), tool.id)
  TOOL_ALIAS_TO_ID.set(normalizeToolKey(tool.label), tool.id)
}

/** Common chatbot / user phrasing → canonical tool id. */
const EXTRA_ALIASES: Record<string, WellnessToolId> = {
  journaling: 'micro-journal',
  'micro journal': 'micro-journal',
  journal: 'micro-journal',
  reframing: 'reframes',
  reframe: 'reframes',
  'safe place': 'safe-place',
  'safe space': 'safe-place',
  'safe place visualization': 'safe-place',
  'name it to tame it': 'name-it',
  'name it': 'name-it',
  'feelings wheel': 'name-it',
  'feelings-wheel': 'name-it',
  'feelings wheel & draw': 'name-it',
  'emotional overload': 'name-it',
  'cold reset': 'physical-regulation',
  'move it out': 'physical-regulation',
  'body scan': 'physical-regulation',
  'guided breathing': 'breathing',
  'breathing exercise': 'breathing',
  'breathing exercises': 'breathing',
  breathe: 'breathing',
  breath: 'breathing',
  'grounding exercise': 'grounding',
  '5-4-3-2-1 grounding': 'grounding',
  '5 4 3 2 1 grounding': 'grounding',
  '5-4-3-2-1': 'grounding',
  grounding: 'grounding',
  nudges: 'today-nudge',
  nudge: 'today-nudge',
  "today's nudge": 'today-nudge',
  'todays nudge': 'today-nudge',
  'crisis support': 'crisis-reset',
  'crisis resources': 'crisis-reset',
  'help right now': 'crisis-reset',
  'i need help right now': 'crisis-reset',
}

for (const [alias, toolId] of Object.entries(EXTRA_ALIASES)) {
  TOOL_ALIAS_TO_ID.set(normalizeToolKey(alias), toolId)
}

export function buildToolRoute(toolId: WellnessToolId): string {
  return WELLNESS_TOOL_ROUTE_MAP[toolId]
}

export function isWellnessToolId(value: string): value is WellnessToolId {
  return Object.prototype.hasOwnProperty.call(WELLNESS_TOOL_REGISTRY, value)
}

export function isLiveWellnessToolId(value: string): value is LiveMoodWellnessToolId {
  return (LIVE_MOOD_TOOL_IDS as readonly string[]).includes(value)
}

export function resolveWellnessToolRoute(...candidates: Array<string | null | undefined>): string | null {
  const tool = resolveSelectedTool(...candidates)
  return tool?.route ?? null
}

export function resolveSelectedTool(
  ...candidates: Array<string | null | undefined>
): ResolvedWellnessTool | null {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const normalized = normalizeToolKey(candidate)
    if (!normalized || BLOCKED_TOOL_KEYS.has(normalized)) continue
    const toolId = TOOL_ALIAS_TO_ID.get(normalized)
    if (toolId) {
      return resolveWellnessToolById(toolId)
    }
  }
  return null
}

/** Human-readable list for chat prompts — name → internal path. */
export function formatWellnessToolRouteMapForPrompt(): string {
  return (Object.keys(WELLNESS_TOOL_ROUTE_MAP) as WellnessToolId[])
    .map((id) => `- ${WELLNESS_TOOL_LABELS[id]} → ${WELLNESS_TOOL_ROUTE_MAP[id]}`)
    .join('\n')
}
