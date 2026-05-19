import { useState } from 'react'

import { formatSupportResourceLocation } from '../../lib/supportResource'
import type { SupportResource } from '../../lib/supabase'
import { CARDEA_ALMOST_WHITE, CARDEA_DARK_GREEN, CARDEA_MUTED, CARDEA_NAVY } from '../../ui/cardeaTokens'
import { CategoryBadge } from '../ui/categoryBadge'

function ExternalLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  )
}

/** Single-column resource row (primary Find Support list). */
export function SupportResourceListCard({ resource }: { resource: SupportResource }) {
  const [hovered, setHovered] = useState(false)
  const locationLine = formatSupportResourceLocation(resource)

  return (
    <li
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: '1px solid rgba(25, 43, 63, 0.1)',
        borderRadius: '14px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: hovered ? '0 8px 28px rgba(25, 43, 63, 0.08)' : '0 2px 10px rgba(25, 43, 63, 0.04)',
        transition: 'all 0.2s ease',
        listStyle: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            color: CARDEA_NAVY,
            lineHeight: 1.3,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {resource.name}
        </h3>
        <CategoryBadge variant="support">{resource.category}</CategoryBadge>
      </div>

      {resource.description && (
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: CARDEA_DARK_GREEN,
            lineHeight: 1.65,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {resource.description}
        </p>
      )}

      {locationLine && (
        <p
          style={{
            margin: 0,
            fontSize: '0.78rem',
            color: CARDEA_MUTED,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          📍 {locationLine}
        </p>
      )}

      {resource.link && (
        <a
          href={resource.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: CARDEA_DARK_GREEN,
            color: CARDEA_ALMOST_WHITE,
            padding: '8px 18px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'none',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'background 0.2s ease',
            width: 'fit-content',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = CARDEA_NAVY
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = CARDEA_DARK_GREEN
          }}
        >
          Visit Website
          <ExternalLinkIcon />
        </a>
      )}
    </li>
  )
}
