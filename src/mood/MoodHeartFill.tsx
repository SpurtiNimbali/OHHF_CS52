import type { MoodTheme } from './moodVariants'

type MoodHeartFillProps = {
  theme: MoodTheme
  pathD: string
  size: number
  viewBox: string
  stroke: string
  strokeWidth: number | string
}

/** Heart icon — solid `theme.heartFill` (gradients live on borders / reminder / shell only). */
export function MoodHeartFill({ theme, pathD, size, viewBox, stroke, strokeWidth }: MoodHeartFillProps) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none" aria-hidden>
      <path
        d={pathD}
        fill={theme.heartFill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  )
}
