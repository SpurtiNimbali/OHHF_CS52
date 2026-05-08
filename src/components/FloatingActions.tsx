import { useEffect, useState } from 'react'

// ── Sticky vertical DONATE tab ───────────────────────────────────────────────

function DonateTab({ navHeight }: { navHeight: number }) {
  return (
    <a
      href="https://www.okheart.com/giving"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: 'fixed',
        right: 0,
        bottom: `${navHeight + 48}px`,
        transform: 'rotate(90deg)',
        transformOrigin: 'right bottom',
        background: '#192b3f',
        color: '#f5f9f9',
        padding: '10px 20px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontFamily: 'Inter, system-ui, sans-serif',
        textDecoration: 'none',
        zIndex: 99,
        borderRadius: '0 0 8px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '-2px 0 12px rgba(25,43,63,0.15)',
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#577568')}
      onMouseLeave={e => (e.currentTarget.style.background = '#192b3f')}
    >
      ♥ Donate
    </a>
  )
}

// ── Back to Top button ───────────────────────────────────────────────────────

function BackToTop({ navHeight }: { navHeight: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      style={{
        position: 'fixed',
        bottom: `${navHeight + 16}px`,
        left: '72px',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: '#192b3f',
        color: '#f5f9f9',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        boxShadow: '0 4px 14px rgba(25,43,63,0.25)',
        zIndex: 99,
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#577568')}
      onMouseLeave={e => (e.currentTarget.style.background = '#192b3f')}
    >
      ↑
    </button>
  )
}

// ── Accessibility button ─────────────────────────────────────────────────────

function AccessibilityButton({ navHeight }: { navHeight: number }) {
  return (
    <button
      aria-label="Accessibility options"
      title="Accessibility"
      style={{
        position: 'fixed',
        bottom: `${navHeight + 16}px`,
        left: '24px',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: '#192b3f',
        color: '#f5f9f9',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        boxShadow: '0 4px 14px rgba(25,43,63,0.25)',
        zIndex: 99,
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#577568')}
      onMouseLeave={e => (e.currentTarget.style.background = '#192b3f')}
    >
      ⓘ
    </button>
  )
}

// ── Export ───────────────────────────────────────────────────────────────────

export default function FloatingActions({ navHeight = 0 }: { navHeight?: number }) {
  return (
    <>
      <DonateTab navHeight={navHeight} />
      <AccessibilityButton navHeight={navHeight} />
      <BackToTop navHeight={navHeight} />
    </>
  )
}
