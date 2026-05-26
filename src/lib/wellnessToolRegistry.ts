export type WellnessToolId =
  | 'breathing'
  | 'grounding'
  | 'physical-regulation'
  | 'name-it'
  | 'micro-journal'
  | 'reframes'
  | 'safe-place'
  | 'today-nudge'

export type WellnessToolSection = 'Regulate body' | 'Understand' | 'Shift mindset' | 'Connect'

export type ResolvedWellnessTool = {
  id: WellnessToolId
  label: string
  route: string
  section: WellnessToolSection
}

export const LIVE_TOOL_ALLOWLIST = [
  {
    id: 'breathing',
    label: 'Guided breathing',
    route: '/wellness?tool=breathing',
    section: 'Regulate body',
  },
  {
    id: 'grounding',
    label: '5-4-3-2-1 Grounding',
    route: '/wellness?tool=grounding',
    section: 'Regulate body',
  },
  {
    id: 'physical-regulation',
    label: 'Physical regulation',
    route: '/wellness?tool=physical-regulation',
    section: 'Regulate body',
  },
  {
    id: 'name-it',
    label: 'Name It to Tame It',
    route: '/wellness?tool=name-it',
    section: 'Understand',
  },
  {
    id: 'micro-journal',
    label: 'Micro-journal',
    route: '/wellness?tool=micro-journal',
    section: 'Understand',
  },
  {
    id: 'reframes',
    label: 'Reframes',
    route: '/wellness?tool=reframes',
    section: 'Shift mindset',
  },
  {
    id: 'safe-place',
    label: 'Safe Place Visualization',
    route: '/wellness?tool=safe-place',
    section: 'Shift mindset',
  },
  {
    id: 'today-nudge',
    label: "Today's Nudge",
    route: '/wellness?tool=today-nudge',
    section: 'Connect',
  },
] as const satisfies readonly ResolvedWellnessTool[]

export const WELLNESS_TOOL_REGISTRY = Object.fromEntries(
  LIVE_TOOL_ALLOWLIST.map((tool) => [tool.id, tool]),
) as Record<WellnessToolId, ResolvedWellnessTool>

function normalizeToolKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const BLOCKED_TOOL_KEYS = new Set(
  [
    'stop-skill',
    'stop skill',
    'feelings-wheel',
    'feelings wheel',
    'night-reset',
    'night reset',
    'be the parent',
  ].map(normalizeToolKey),
)

const TOOL_ALIAS_TO_ID = new Map<string, WellnessToolId>()

for (const tool of LIVE_TOOL_ALLOWLIST) {
  TOOL_ALIAS_TO_ID.set(normalizeToolKey(tool.id), tool.id)
  TOOL_ALIAS_TO_ID.set(normalizeToolKey(tool.label), tool.id)
}

const EXTRA_ALIASES: Record<string, WellnessToolId> = {
  journaling: 'micro-journal',
  'micro journal': 'micro-journal',
  journal: 'micro-journal',
  reframing: 'reframes',
  reframe: 'reframes',
  'safe place': 'safe-place',
  'safe place visualization': 'safe-place',
  'name it to tame it': 'name-it',
  'cold reset': 'physical-regulation',
  'move it out': 'physical-regulation',
  'body scan': 'physical-regulation',
  'guided breathing': 'breathing',
  'breathing exercise': 'breathing',
  'grounding exercise': 'grounding',
  '5-4-3-2-1 grounding': 'grounding',
  '5 4 3 2 1 grounding': 'grounding',
  'todays nudge': 'today-nudge',
  breathe: 'breathing',
  breath: 'breathing',
}

for (const [alias, toolId] of Object.entries(EXTRA_ALIASES)) {
  TOOL_ALIAS_TO_ID.set(normalizeToolKey(alias), toolId)
}

export function buildToolRoute(toolId: WellnessToolId): string {
  return WELLNESS_TOOL_REGISTRY[toolId].route
}

export function isLiveWellnessToolId(value: string): value is WellnessToolId {
  return Object.prototype.hasOwnProperty.call(WELLNESS_TOOL_REGISTRY, value)
}

export function resolveSelectedTool(
  ...candidates: Array<string | null | undefined>
): ResolvedWellnessTool | null {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const normalized = normalizeToolKey(candidate)
    if (!normalized || BLOCKED_TOOL_KEYS.has(normalized)) continue
    const toolId = TOOL_ALIAS_TO_ID.get(normalized)
    if (toolId) return WELLNESS_TOOL_REGISTRY[toolId]
  }
  return null
}
