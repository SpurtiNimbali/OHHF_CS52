import { useState, type FC } from 'react'
import type { CSSProperties } from 'react'

interface BackButtonProps {
  onClick: () => void
  /** Label only; a leading arrow is always shown. */
  text?: string
  style?: CSSProperties
  /** Use the navy / pill treatment for light backgrounds (resource hub). */
  variant?: 'default' | 'onLight'
}

const NAVY = '#192b3f'
const LIGHT_BLUE = '#c6d9e5'
const FONT = 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'

const BackButton: FC<BackButtonProps> = ({
  onClick,
  text = 'Back',
  style = {},
  variant = 'default',
}) => {
  const [hover, setHover] = useState(false)
  const light = variant === 'onLight'
  const base: CSSProperties = {
    padding: '10px 20px',
    borderRadius: 9999,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: FONT,
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    ...(light
      ? {
          backgroundColor: hover ? 'rgba(25, 43, 63, 0.1)' : 'rgba(25, 43, 63, 0.06)',
          color: NAVY,
          borderColor: hover ? 'rgba(25, 43, 63, 0.18)' : 'rgba(25, 43, 63, 0.12)',
        }
      : {
          backgroundColor: hover ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.14)',
          color: '#fff',
          borderColor: hover ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.25)',
        }),
    ...style,
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={base}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ color: light ? NAVY : LIGHT_BLUE, fontSize: 16 }} aria-hidden>
        ←
      </span>
      {text}
    </button>
  )
}

export default BackButton
