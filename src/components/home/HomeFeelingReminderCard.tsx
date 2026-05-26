import { Sparkles } from 'lucide-react'

import { CARDEA_FONT_PRIMARY } from '../../ui/cardeaTokens'

type HomeFeelingReminderCardProps = {
  title: string
  message: string
  reminderBgClass: string
  heartStroke: string
}

/** Non-interactive mood tagline — matches the original home reminder panel. */
export function HomeFeelingReminderCard({
  title,
  message,
  reminderBgClass,
  heartStroke,
}: HomeFeelingReminderCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 shadow-md transition-all duration-700 ${reminderBgClass}`}
    >
      <div className="relative z-10 flex items-start gap-3">
        <Sparkles className="h-6 w-6 shrink-0" style={{ color: heartStroke }} strokeWidth={2} />
        <div>
          <h3
            className="mb-1 text-sm font-semibold text-[#062A4A]"
            style={{ fontFamily: CARDEA_FONT_PRIMARY }}
          >
            {title}
          </h3>
          <p
            className="text-sm leading-relaxed text-[#3A525A]"
            style={{ fontFamily: CARDEA_FONT_PRIMARY }}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}
