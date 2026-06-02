import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { CARDEA_FONT_PRIMARY } from '../../ui/cardeaTokens'

type HomeResourceLinkCardProps = {
  to: string
  Icon: LucideIcon
  title: string
  description: string
  iconWrapClass: string
  iconClass: string
  /** When set, runs instead of router navigation (e.g. async chat open with prefill). */
  onClick?: () => void
}

const cardClassName =
  'flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow min-h-[4.5rem] w-full text-left'

/** Large tappable tile on Home — “Learning & resources” style rows. */
export function HomeResourceLinkCard({
  to,
  Icon,
  title,
  description,
  iconWrapClass,
  iconClass,
  onClick,
}: HomeResourceLinkCardProps) {
  const content = (
    <>
      <div className={`${iconWrapClass} p-3 rounded-xl shrink-0`}>
        <Icon className={`w-6 h-6 ${iconClass}`} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <h3
          className="text-[#062A4A] mb-0.5 font-semibold text-[15px] leading-snug"
          style={{ fontFamily: CARDEA_FONT_PRIMARY }}
        >
          {title}
        </h3>
        <p className="text-xs sm:text-sm mt-1 leading-relaxed text-[#3A525A]" style={{ fontFamily: CARDEA_FONT_PRIMARY }}>
          {description}
        </p>
      </div>
      <ChevronRight className="w-5 h-5 shrink-0 text-[#8BD7D2]" aria-hidden />
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cardClassName}>
        {content}
      </button>
    )
  }

  return (
    <Link to={to} className={cardClassName}>
      {content}
    </Link>
  )
}
