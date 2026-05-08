import { CARDEA_NAVY } from '../../ui/cardeaTokens'

type QuestionTopicBadgeProps = {
  label: string
  /** Saved cards use slightly lighter fill than freshly suggested rows */
  accent: 'saved' | 'suggested'
}

export function QuestionTopicBadge({ label, accent }: QuestionTopicBadgeProps) {
  const background = accent === 'saved' ? 'rgba(198, 217, 229, 0.45)' : 'rgba(198, 217, 229, 0.5)'
  return (
    <span
      className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background, color: CARDEA_NAVY }}
    >
      {label}
    </span>
  )
}
