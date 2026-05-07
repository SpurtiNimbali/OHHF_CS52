import { useState, type FC, type ReactNode } from 'react'

import { CARDEA_FONT_PRIMARY, CARDEA_LIGHT_BLUE, CARDEA_MUTED, CARDEA_NAVY } from '../ui/cardeaTokens'

interface NavCardProps {
  title: string
  /** Small icon shown in the top-left tile (e.g. SVG or emoji). */
  icon: ReactNode
  iconBackground: string
  onClick: () => void
  description?: string
  /** Accent for arrow and focus ring (light blue in brand). */
  arrowColor?: string
}

const NavCard: FC<NavCardProps> = ({
  title,
  icon,
  iconBackground,
  onClick,
  description,
  arrowColor = CARDEA_LIGHT_BLUE,
}) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        fontFamily: CARDEA_FONT_PRIMARY,
        textAlign: 'left',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: '28px 24px 24px',
        border: `1px solid ${isHovered ? 'rgba(198, 217, 229, 0.95)' : 'rgba(25, 43, 63, 0.1)'}`,
        boxShadow: isHovered
          ? '0 10px 36px rgba(25, 43, 63, 0.08)'
          : '0 4px 20px rgba(25, 43, 63, 0.05)',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        minHeight: 220,
        gap: 16,
        width: '100%',
        boxSizing: 'border-box',
        margin: 0,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: iconBackground,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#fff',
        }}
      >
        {icon}
      </div>

      <h3
        style={{
          margin: 0,
          fontSize: '0.95rem',
          fontWeight: 700,
          color: CARDEA_NAVY,
          letterSpacing: '0.06em',
          lineHeight: 1.35,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            margin: 0,
            fontSize: '0.95rem',
            color: CARDEA_MUTED,
            lineHeight: 1.55,
            flex: 1,
          }}
        >
          {description}
        </p>
      )}

      <span
        aria-hidden
        style={{
          fontSize: '1.25rem',
          color: arrowColor,
          lineHeight: 1,
          alignSelf: 'flex-start',
          marginTop: 'auto',
          paddingTop: 4,
          transform: isHovered ? 'translateX(4px)' : 'none',
          transition: 'transform 0.2s ease',
        }}
      >
        →
      </span>
    </button>
  )
}

export default NavCard
