import React from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Phone, Users } from 'lucide-react'
import { CRISIS_RESOURCES, CrisisResource } from '../lib/crisisKeywords'
import { CARDEA_DARK_GREEN, CARDEA_MUTED } from '../ui/cardeaTokens'

interface CrisisCardProps {
  showIcon?: boolean
  compact?: boolean
}

function phoneHref(number: string): string | null {
  const digits = number.replace(/\D/g, '')
  if (digits.length >= 3 && digits.length <= 15) return `tel:${digits}`
  return null
}

const CrisisCard: React.FC<CrisisCardProps> = ({ showIcon = true, compact = false }) => {
  return (
    <div
      className={compact ? 'my-4 rounded-xl border-l-4 p-3' : 'my-4 rounded-xl border-l-4 p-4'}
      style={{
        backgroundColor: '#fff5f7',
        borderLeftColor: '#9B1C31',
      }}
    >
      {showIcon ? <div className="mb-2 text-2xl">💙</div> : null}

      <h3
        className={compact ? 'mb-2 text-base font-bold text-[#9B1C31]' : 'mb-2 text-lg font-bold text-[#9B1C31]'}
      >
        You&apos;re not alone — help is available now
      </h3>

      <p className={`mb-3 leading-relaxed text-[#555] ${compact ? 'text-sm' : 'text-sm'}`}>
        If you&apos;re in crisis or having thoughts of self-harm, please reach out right away:
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <a
          href="tel:988"
          className="inline-flex items-center gap-2 rounded-lg bg-[#9B1C31] px-3 py-2 text-sm font-semibold text-white"
        >
          <Phone className="h-4 w-4" aria-hidden />
          Call or text 988
        </a>
        <a
          href="tel:911"
          className="inline-flex items-center gap-2 rounded-lg border border-[#9B1C31]/30 bg-white px-3 py-2 text-sm font-semibold text-[#9B1C31]"
        >
          Call 911
        </a>
      </div>

      <div className="grid gap-2">
        {CRISIS_RESOURCES.filter((r) => r.number !== '988').map((resource: CrisisResource) => (
          <ResourceItem key={resource.name} resource={resource} compact={compact} />
        ))}
      </div>

      <div
        className="mt-4 rounded-lg border bg-white p-3"
        style={{ borderColor: 'rgba(155, 28, 49, 0.15)' }}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: CARDEA_MUTED }}>
          More in Cardea
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/wellness#crisis"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f9f9] px-3 py-1.5 text-xs font-semibold text-[#192b3f]"
          >
            Crisis support tools
          </Link>
          <Link
            to="/chat"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f9f9] px-3 py-1.5 text-xs font-semibold text-[#192b3f]"
          >
            <MessageCircle className="h-3 w-3" style={{ color: CARDEA_DARK_GREEN }} aria-hidden />
            Chat
          </Link>
          <Link
            to="/resources?view=support"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f9f9] px-3 py-1.5 text-xs font-semibold text-[#192b3f]"
          >
            <Users className="h-3 w-3" style={{ color: CARDEA_DARK_GREEN }} aria-hidden />
            Find support
          </Link>
        </div>
      </div>

      <p className={`mt-3 italic text-[#888] ${compact ? 'text-xs' : 'text-sm'}`}>
        This conversation has been flagged for our medical support team to review. Your safety is
        our priority.
      </p>
    </div>
  )
}

interface ResourceItemProps {
  resource: CrisisResource
  compact?: boolean
}

const ResourceItem: React.FC<ResourceItemProps> = ({ resource, compact = false }) => {
  const href = resource.number.startsWith('http') ? resource.number : phoneHref(resource.number)

  return (
    <div
      className={`flex gap-3 rounded-lg border border-[#f0c0d0] bg-white ${compact ? 'p-2' : 'p-3'}`}
    >
      <div className="shrink-0 text-lg">📱</div>
      <div className="min-w-0 flex-1">
        <div className={`font-bold text-[#222] ${compact ? 'text-sm' : 'text-sm'}`}>{resource.name}</div>
        <div className={`text-[#666] ${compact ? 'text-xs' : 'text-sm'}`}>{resource.description}</div>
        {href ? (
          <a
            href={href}
            target={href.startsWith('http') ? '_blank' : undefined}
            rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="mt-1 inline-block text-sm font-bold text-[#9B1C31] underline-offset-2 hover:underline"
          >
            {resource.number}
          </a>
        ) : (
          <div className="mt-1 text-sm font-bold text-[#9B1C31]">{resource.number}</div>
        )}
        <div className="text-[11px] text-[#999]">{resource.available}</div>
      </div>
    </div>
  )
}

export default CrisisCard
