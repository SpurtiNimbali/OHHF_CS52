import type { CSSProperties } from 'react'

import type { SupportResource } from '../../lib/supabase'
import { CARDEA_DARK_GREEN, CARDEA_MUTED, CARDEA_NAVY } from '../../ui/cardeaTokens'
import { CategoryBadge } from '../ui/categoryBadge'

function GridCardInterior({
  name,
  categoryLabel,
  description,
  locationLine,
}: Pick<PersonalizedSupportGridCardProps, 'name' | 'categoryLabel' | 'description' | 'locationLine'>) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: CARDEA_NAVY,
            margin: 0,
            lineHeight: 1.35,
            flex: 1,
            minWidth: 0,
          }}
        >
          {name}
        </h3>
        <CategoryBadge variant="support" style={{ maxWidth: '46%', textAlign: 'right' }}>
          {categoryLabel}
        </CategoryBadge>
      </div>

      {description ? (
        <p
          style={{
            color: CARDEA_DARK_GREEN,
            fontSize: '0.9375rem',
            lineHeight: 1.55,
            margin: '0 0 12px',
          }}
        >
          {description}
        </p>
      ) : null}

      {locationLine ? (
        <p
          style={{
            margin: '0 0 12px',
            fontSize: '0.85rem',
            color: CARDEA_MUTED,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span aria-hidden>📍</span>
          {locationLine}
        </p>
      ) : null}

      <div
        style={{
          marginTop: 'auto',
          paddingTop: '14px',
          height: '3px',
          background: 'rgba(198, 217, 229, 0.65)',
          borderRadius: '2px',
        }}
      />
    </>
  )
}

type PersonalizedSupportGridCardProps = {
  resource: Pick<SupportResource, 'id' | 'name' | 'description' | 'city' | 'zipcode'>
  categoryLabel: string
  locationLine: string
  href: string | null
  index: number
}

const cardShellBase: Omit<CSSProperties, 'cursor' | 'animation'> = {
  background: '#ffffff',
  borderRadius: '16px',
  padding: '24px',
  boxShadow: '0 2px 12px rgba(25, 43, 63, 0.06)',
  border: '1px solid rgba(25, 43, 63, 0.1)',
  transition: 'all 0.25s ease',
  height: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  textDecoration: 'none',
  color: 'inherit',
}

/** Animated clickable tile used for personalized picks on Find Support. */
export function PersonalizedSupportGridCard({
  resource,
  categoryLabel,
  locationLine,
  href,
  index,
}: PersonalizedSupportGridCardProps) {
  const { name, description } = resource

  const cardShellStyle: CSSProperties = {
    ...cardShellBase,
    animation: `fadeInUp 0.5s ease ${index * 0.04}s both`,
    cursor: href ? 'pointer' : 'default',
  }

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${name} — opens in a new tab`}
        style={cardShellStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px)'
          e.currentTarget.style.boxShadow = '0 10px 28px rgba(25, 43, 63, 0.1)'
          e.currentTarget.style.borderColor = 'rgba(87, 117, 104, 0.45)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 2px 12px rgba(25, 43, 63, 0.06)'
          e.currentTarget.style.borderColor = 'rgba(25, 43, 63, 0.1)'
        }}
      >
        <GridCardInterior name={name} categoryLabel={categoryLabel} description={description} locationLine={locationLine} />
      </a>
    )
  }

  return (
    <div
      style={cardShellStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(87, 117, 104, 0.45)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(25, 43, 63, 0.1)'
      }}
    >
      <GridCardInterior name={name} categoryLabel={categoryLabel} description={description} locationLine={locationLine} />
    </div>
  )
}
