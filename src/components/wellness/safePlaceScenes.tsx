import type { CSSProperties, ReactElement, ReactNode } from 'react'
import {
  CARDEA_DARK_GREEN,
  CARDEA_LIGHT_BLUE,
  CARDEA_NAVY,
} from '../../ui/cardeaTokens'

export type SafePlaceSceneId =
  | 'forest'
  | 'shore'
  | 'cozy-room'
  | 'garden'
  | 'meadow'
  | 'starry-lake'

export type SafePlaceScene = {
  id: SafePlaceSceneId
  label: string
  tagline: string
}

export const SAFE_PLACE_SCENES: SafePlaceScene[] = [
  { id: 'forest', label: 'Forest clearing', tagline: 'Filtered light through quiet trees' },
  { id: 'shore', label: 'Gentle shore', tagline: 'Soft waves and open horizon' },
  { id: 'cozy-room', label: 'Cozy nook', tagline: 'Warm light in a familiar room' },
  { id: 'garden', label: 'Garden bench', tagline: 'Flowers, still air, and green' },
  { id: 'meadow', label: 'Open meadow', tagline: 'Wide sky and rolling hills' },
  { id: 'starry-lake', label: 'Still lake', tagline: 'Calm water under evening light' },
]

const SCENE_LOOKUP = Object.fromEntries(SAFE_PLACE_SCENES.map((s) => [s.id, s])) as Record<
  SafePlaceSceneId,
  SafePlaceScene
>

export function safePlaceSceneMeta(id: SafePlaceSceneId) {
  return SCENE_LOOKUP[id]
}

type SceneArtProps = {
  className?: string
  style?: CSSProperties
  animate?: boolean
  warmth?: number
}

function SceneFrame({
  children,
  className = '',
  style,
  animate = false,
  warmth = 0,
}: SceneArtProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 400 240"
      xmlns="http://www.w3.org/2000/svg"
      className={`h-full w-full ${animate ? 'safe-place-scene-animate' : ''} ${className}`.trim()}
      style={style}
      aria-hidden
    >
      <defs>
        <linearGradient id="sp-sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#dbe8ef" />
          <stop offset="100%" stopColor="#c6d9e5" />
        </linearGradient>
        <filter id="sp-soft-glow">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {warmth > 0 ? (
        <rect width="400" height="240" fill={`rgba(255, 214, 170, ${0.08 + warmth * 0.12})`} />
      ) : null}
      {children}
    </svg>
  )
}

export function ForestClearingScene(props: SceneArtProps) {
  return (
    <SceneFrame {...props}>
      <rect width="400" height="240" fill="url(#sp-sky)" />
      <ellipse cx="200" cy="250" rx="220" ry="80" fill="#8aa88f" opacity="0.35" />
      <ellipse cx="120" cy="210" rx="90" ry="40" fill={CARDEA_DARK_GREEN} opacity="0.55" />
      <ellipse cx="290" cy="215" rx="110" ry="45" fill="#466556" opacity="0.5" />
      <rect x="0" y="170" width="400" height="70" fill="#577568" opacity="0.25" />
      <path
        d="M55 170 C70 120 95 95 110 170 Z M95 170 C108 105 128 88 140 170 Z M130 170 C145 115 168 92 182 170 Z"
        fill="#466556"
        opacity="0.85"
      />
      <path
        d="M250 170 C265 108 290 82 305 170 Z M285 170 C300 118 322 96 335 170 Z M320 170 C338 125 360 100 378 170 Z"
        fill="#577568"
        opacity="0.8"
      />
      <circle cx="310" cy="58" r="28" fill="#f4e8c8" opacity="0.85" filter="url(#sp-soft-glow)" />
      <path
        d="M0 185 Q120 175 200 182 T400 188 L400 240 L0 240 Z"
        fill="#6d8878"
        opacity="0.45"
      />
      <ellipse cx="200" cy="198" rx="55" ry="12" fill="#192b3f" opacity="0.08" />
    </SceneFrame>
  )
}

export function GentleShoreScene(props: SceneArtProps) {
  return (
    <SceneFrame {...props}>
      <rect width="400" height="240" fill="url(#sp-sky)" />
      <rect x="0" y="118" width="400" height="122" fill="#9ec4d4" opacity="0.55" />
      <path
        d="M0 132 C60 118 120 145 180 128 S300 112 400 136 L400 240 L0 240 Z"
        fill="#7eb3c9"
        opacity="0.65"
      />
      <path
        d="M0 152 C70 140 140 162 210 148 S340 136 400 158 L400 240 L0 240 Z"
        fill="#6aa3bc"
        opacity="0.5"
      />
      <ellipse cx="200" cy="205" rx="180" ry="18" fill="#c6d9e5" opacity="0.35" />
      <path d="M0 188 Q100 176 200 184 T400 190" fill="none" stroke="#f5f9f9" strokeWidth="3" opacity="0.45" />
      <circle cx="330" cy="52" r="24" fill="#f7efd8" opacity="0.9" />
      <path d="M20 210 Q35 205 50 210 T80 210" fill="none" stroke="#f5f9f9" strokeWidth="2" opacity="0.35" />
    </SceneFrame>
  )
}

export function CozyNookScene(props: SceneArtProps) {
  return (
    <SceneFrame {...props} warmth={props.warmth ?? 0.4}>
      <rect width="400" height="240" fill="#2a3d52" />
      <rect x="0" y="0" width="400" height="240" fill="url(#sp-sky)" opacity="0.15" />
      <rect x="28" y="36" width="120" height="110" rx="6" fill="#f4e8c8" opacity="0.75" />
      <rect x="36" y="44" width="104" height="94" rx="4" fill="#dbe8ef" opacity="0.35" />
      <path d="M36 118 L140 118" stroke={CARDEA_NAVY} strokeWidth="2" opacity="0.12" />
      <path d="M36 92 L140 92" stroke={CARDEA_NAVY} strokeWidth="2" opacity="0.12" />
      <rect x="0" y="168" width="400" height="72" fill="#4a5f4f" opacity="0.55" />
      <path
        d="M170 168 L170 118 Q170 98 195 98 L285 98 Q310 98 310 118 L310 168 Z"
        fill="#577568"
        opacity="0.85"
      />
      <ellipse cx="240" cy="145" rx="48" ry="22" fill="#6d8878" opacity="0.55" />
      <circle cx="350" cy="70" r="18" fill="#ffd9a8" opacity="0.55" filter="url(#sp-soft-glow)" />
      <rect x="300" y="130" width="14" height="38" rx="4" fill="#466556" opacity="0.7" />
      <ellipse cx="307" cy="128" rx="22" ry="10" fill="#f4e8c8" opacity="0.5" />
    </SceneFrame>
  )
}

export function GardenBenchScene(props: SceneArtProps) {
  return (
    <SceneFrame {...props}>
      <rect width="400" height="240" fill="url(#sp-sky)" />
      <rect x="0" y="150" width="400" height="90" fill="#8aa88f" opacity="0.4" />
      <circle cx="70" cy="165" r="16" fill="#c9a0b8" opacity="0.65" />
      <circle cx="95" cy="158" r="12" fill="#e8b4c8" opacity="0.55" />
      <circle cx="320" cy="170" r="18" fill="#d4b896" opacity="0.6" />
      <circle cx="345" cy="162" r="14" fill="#e8cdb0" opacity="0.55" />
      <path d="M145 178 L255 178 L255 188 L145 188 Z" fill="#577568" opacity="0.75" />
      <path d="M150 188 L150 205 M250 188 L250 205" stroke="#466556" strokeWidth="5" opacity="0.7" />
      <path
        d="M0 190 Q80 182 160 188 T320 186 T400 192 L400 240 L0 240 Z"
        fill="#6d8878"
        opacity="0.45"
      />
      <path d="M200 60 Q230 40 260 60" fill="none" stroke="#f5f9f9" strokeWidth="2" opacity="0.25" />
    </SceneFrame>
  )
}

export function OpenMeadowScene(props: SceneArtProps) {
  return (
    <SceneFrame {...props}>
      <rect width="400" height="240" fill="url(#sp-sky)" />
      <path
        d="M0 150 C80 120 160 135 240 118 C300 105 360 125 400 112 L400 240 L0 240 Z"
        fill="#8aa88f"
        opacity="0.45"
      />
      <path
        d="M0 175 C100 160 200 170 300 158 C340 153 370 160 400 155 L400 240 L0 240 Z"
        fill="#577568"
        opacity="0.35"
      />
      <ellipse cx="200" cy="188" rx="120" ry="16" fill="#466556" opacity="0.15" />
      <circle cx="80" cy="55" r="20" fill="#f5f9f9" opacity="0.85" />
      <circle cx="110" cy="48" r="14" fill="#f5f9f9" opacity="0.7" />
      <circle cx="300" cy="62" r="18" fill="#f5f9f9" opacity="0.75" />
      <path d="M185 175 L185 148" stroke="#6d8878" strokeWidth="2" opacity="0.5" />
      <circle cx="185" cy="142" r="6" fill="#e8cdb0" opacity="0.65" />
    </SceneFrame>
  )
}

export function StillLakeScene(props: SceneArtProps) {
  return (
    <SceneFrame {...props}>
      <rect width="400" height="240" fill="#1e3348" />
      <rect x="0" y="0" width="400" height="110" fill="#2a4560" />
      <circle cx="60" cy="38" r="1.5" fill="#f5f9f9" opacity="0.8" />
      <circle cx="120" cy="22" r="1" fill="#f5f9f9" opacity="0.6" />
      <circle cx="200" cy="30" r="1.2" fill="#f5f9f9" opacity="0.7" />
      <circle cx="280" cy="18" r="1" fill="#f5f9f9" opacity="0.55" />
      <circle cx="340" cy="42" r="1.3" fill="#f5f9f9" opacity="0.65" />
      <ellipse cx="310" cy="55" rx="22" ry="22" fill="#e8d4b0" opacity="0.35" />
      <rect x="0" y="108" width="400" height="132" fill="#3d6278" opacity="0.75" />
      <ellipse cx="200" cy="118" rx="160" ry="8" fill="#c6d9e5" opacity="0.2" />
      <path d="M0 145 Q100 138 200 142 T400 146" fill="none" stroke="#7eb3c9" strokeWidth="1.5" opacity="0.35" />
      <path
        d="M0 175 C90 168 180 178 270 170 C320 166 360 172 400 168 L400 240 L0 240 Z"
        fill="#2a4560"
        opacity="0.55"
      />
      <ellipse cx="200" cy="200" rx="90" ry="10" fill="#192b3f" opacity="0.12" />
    </SceneFrame>
  )
}

const SCENE_COMPONENTS: Record<SafePlaceSceneId, (props: SceneArtProps) => ReactElement> = {
  forest: ForestClearingScene,
  shore: GentleShoreScene,
  'cozy-room': CozyNookScene,
  garden: GardenBenchScene,
  meadow: OpenMeadowScene,
  'starry-lake': StillLakeScene,
}

export function SafePlaceSceneArt({
  sceneId,
  ...props
}: SceneArtProps & { sceneId: SafePlaceSceneId }) {
  const Component = SCENE_COMPONENTS[sceneId]
  return <Component {...props} />
}

const SCENE_KEYWORDS: Record<SafePlaceSceneId, string[]> = {
  forest: ['forest', 'woods', 'tree', 'trail', 'pine', 'cabin'],
  shore: ['beach', 'ocean', 'shore', 'sea', 'wave', 'coast', 'sand'],
  'cozy-room': ['room', 'home', 'couch', 'bed', 'blanket', 'fireplace', 'nook', 'kitchen'],
  garden: ['garden', 'flower', 'bench', 'yard', 'rose', 'backyard'],
  meadow: ['meadow', 'field', 'hill', 'grass', 'open', 'valley'],
  'starry-lake': ['lake', 'pond', 'river', 'water', 'moon', 'night', 'stars'],
}

export function inferSafePlaceScene(name: string, description: string): SafePlaceSceneId {
  const text = `${name} ${description}`.toLowerCase()
  let best: SafePlaceSceneId = 'meadow'
  let bestScore = 0
  for (const scene of SAFE_PLACE_SCENES) {
    const score = SCENE_KEYWORDS[scene.id].reduce(
      (acc, word) => (text.includes(word) ? acc + 1 : acc),
      0,
    )
    if (score > bestScore) {
      bestScore = score
      best = scene.id
    }
  }
  return best
}

export const DEFAULT_SAFE_PLACE_SCENE: SafePlaceSceneId = 'forest'

const SCENE_STORAGE_KEY = 'cardea-safe-place-scene'
const SCENE_MAP_KEY = 'cardea-safe-place-scene-map'

export function loadPreferredScene(): SafePlaceSceneId {
  try {
    const raw = localStorage.getItem(SCENE_STORAGE_KEY)
    if (raw && raw in SCENE_LOOKUP) return raw as SafePlaceSceneId
  } catch {
    /* ignore */
  }
  return DEFAULT_SAFE_PLACE_SCENE
}

export function savePreferredScene(sceneId: SafePlaceSceneId) {
  try {
    localStorage.setItem(SCENE_STORAGE_KEY, sceneId)
  } catch {
    /* ignore */
  }
}

export function loadSceneMap(): Record<string, SafePlaceSceneId> {
  try {
    const raw = localStorage.getItem(SCENE_MAP_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, SafePlaceSceneId>
  } catch {
    return {}
  }
}

export function loadSceneForPlace(
  placeId: string,
  map: Record<string, SafePlaceSceneId> = loadSceneMap(),
): SafePlaceSceneId | null {
  return map[placeId] ?? null
}

export function saveSceneForPlace(placeId: string, sceneId: SafePlaceSceneId) {
  try {
    const raw = localStorage.getItem(SCENE_MAP_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, SafePlaceSceneId>) : {}
    map[placeId] = sceneId
    localStorage.setItem(SCENE_MAP_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}
