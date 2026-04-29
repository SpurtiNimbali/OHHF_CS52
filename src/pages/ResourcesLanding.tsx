import { useState } from 'react'
import MedicalGlossary from './MedicalGlossary'
import FindSupport from '../components/FindSupport'
import QuestionsForCardiologist from '../components/QuestionsForCardiologist'
import FloatingActions from '../components/FloatingActions'

type Screen = 'home' | 'support' | 'questions' | 'glossary' | 'marketplace' | 'profile'

const BOTTOM_NAV_HEIGHT = 72

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? '#577568' : '#acb7a8'
  return (
    <svg width="22" height="22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function ResourcesIcon({ active }: { active: boolean }) {
  const c = active ? '#577568' : '#acb7a8'
  return (
    <svg width="22" height="22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  )
}

function MarketplaceIcon({ active }: { active: boolean }) {
  const c = active ? '#577568' : '#acb7a8'
  return (
    <svg width="22" height="22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  const c = active ? '#577568' : '#acb7a8'
  return (
    <svg width="22" height="22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

const NAV_ITEMS: { id: Screen; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'home',        label: 'Home',        Icon: HomeIcon },
  { id: 'support',     label: 'Resources',   Icon: ResourcesIcon },
  { id: 'marketplace', label: 'Marketplace', Icon: MarketplaceIcon },
  { id: 'profile',     label: 'Profile',     Icon: ProfileIcon },
]

// ── BottomNav ─────────────────────────────────────────────────────────────────

function BottomNav({ current, onNavigate }: { current: Screen; onNavigate: (s: Screen) => void }) {
  const activeId: Screen =
    current === 'questions' || current === 'glossary' ? 'support' : current

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: `${BOTTOM_NAV_HEIGHT}px`,
      background: 'rgba(245, 249, 249, 0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid #c6d9e5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV_ITEMS.map(({ id, label, Icon }) => {
        const isActive = activeId === id
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 20px',
              borderRadius: '12px',
            }}
          >
            <Icon active={isActive} />
            <span style={{
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'Inter, system-ui, sans-serif',
              color: isActive ? '#577568' : '#acb7a8',
              transition: 'color 0.15s ease',
            }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

// ── Top Bar ───────────────────────────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.75,
}

function TopBar() {
  return (
    <header style={{
      height: '52px',
      background: '#192b3f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: 'var(--font-display, "Bebas Neue", sans-serif)',
        fontSize: '26px',
        letterSpacing: '0.12em',
        color: '#f5f9f9',
      }}>
        CARDEA
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button aria-label="Search" style={iconBtnStyle}>
          <svg width="16" height="16" fill="none" stroke="#c6d9e5" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7"/>
            <path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
        </button>
        <button aria-label="Language" style={iconBtnStyle}>
          <svg width="16" height="16" fill="none" stroke="#c6d9e5" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9"/>
            <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" strokeLinecap="round"/>
          </svg>
        </button>
        <button aria-label="Account" style={iconBtnStyle}>
          <svg width="16" height="16" fill="none" stroke="#c6d9e5" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </header>
  )
}

// ── Home Panel ────────────────────────────────────────────────────────────────

function HomePanel({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div style={{ padding: '48px 24px 0', maxWidth: '800px', margin: '0 auto' }}>
      {/* Eyebrow */}
      <p style={{
        margin: '0 0 8px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: '#acb7a8',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        Oklahoma Heart Hospital Foundation
      </p>

      {/* Hero heading */}
      <h1 style={{
        margin: '0 0 16px',
        fontFamily: 'var(--font-display, "Bebas Neue", sans-serif)',
        fontSize: 'clamp(3.5rem, 10vw, 6rem)',
        letterSpacing: '0.06em',
        color: '#192b3f',
        lineHeight: 0.95,
      }}>
        CARDEA
      </h1>
      <p style={{
        margin: '0 0 48px',
        fontSize: '1rem',
        color: '#acb7a8',
        lineHeight: 1.7,
        maxWidth: '480px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        Support, tools, and information to help heart families at every step of the journey.
      </p>

      {/* Divider */}
      <div style={{ height: '1px', background: '#c6d9e5', marginBottom: '36px' }} />

      {/* Feature cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '48px',
      }}>
        {([
          { id: 'support'   as Screen, icon: '🤝', label: 'FIND SUPPORT',          desc: 'Local and online resources for heart families' },
          { id: 'questions' as Screen, icon: '💬', label: 'CARDIOLOGIST Q&A',       desc: 'Save questions before your next appointment' },
          { id: 'glossary'  as Screen, icon: '📚', label: 'MEDICAL GLOSSARY',       desc: 'Plain-language heart health terminology' },
        ] as const).map((card) => (
          <button
            key={card.id}
            onClick={() => onNavigate(card.id)}
            style={{
              background: '#fff',
              border: '1.5px solid #c6d9e5',
              borderRadius: '14px',
              padding: '28px 22px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#577568'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(25,43,63,0.1)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#c6d9e5'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'none'
            }}
          >
            <div style={{ fontSize: '26px', marginBottom: '12px' }}>{card.icon}</div>
            <p style={{
              margin: '0 0 6px',
              fontFamily: 'var(--font-display, "Bebas Neue", sans-serif)',
              fontSize: '17px',
              letterSpacing: '0.06em',
              color: '#192b3f',
            }}>
              {card.label}
            </p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#acb7a8', lineHeight: 1.5 }}>
              {card.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Marketplace Placeholder ───────────────────────────────────────────────────

function MarketplacePlaceholder() {
  return (
    <div style={{ padding: '72px 24px', maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
      <p style={{
        margin: '0 0 8px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: '#acb7a8',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        Coming Soon
      </p>
      <h1 style={{
        margin: '0 0 16px',
        fontFamily: 'var(--font-display, "Bebas Neue", sans-serif)',
        fontSize: 'clamp(2.5rem, 7vw, 4rem)',
        letterSpacing: '0.06em',
        color: '#192b3f',
      }}>
        MARKETPLACE
      </h1>
      <p style={{ margin: 0, fontSize: '0.95rem', color: '#acb7a8', lineHeight: 1.7, fontFamily: 'Inter, system-ui, sans-serif' }}>
        A community space for heart families to share and discover resources.
        <br />We're building something special — check back soon.
      </p>
    </div>
  )
}

// ── Profile Placeholder ───────────────────────────────────────────────────────

function ProfilePlaceholder() {
  return (
    <div style={{ padding: '72px 24px', maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
      <p style={{
        margin: '0 0 8px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: '#acb7a8',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        Your Account
      </p>
      <h1 style={{
        margin: '0 0 16px',
        fontFamily: 'var(--font-display, "Bebas Neue", sans-serif)',
        fontSize: 'clamp(2.5rem, 7vw, 4rem)',
        letterSpacing: '0.06em',
        color: '#192b3f',
      }}>
        PROFILE
      </h1>
      <p style={{ margin: 0, fontSize: '0.95rem', color: '#acb7a8', lineHeight: 1.7, fontFamily: 'Inter, system-ui, sans-serif' }}>
        Manage your Cardea account, saved resources, and preferences.
        <br />Profile settings coming soon.
      </p>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

const ResourcesLanding: React.FC = () => {
  const [current, setCurrent] = useState<Screen>('home')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f9f9' }}>
      <TopBar />

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: `${BOTTOM_NAV_HEIGHT}px` }}>
        {current === 'home'        && <HomePanel onNavigate={setCurrent} />}
        {current === 'support'     && <FindSupport />}
        {current === 'questions'   && <QuestionsForCardiologist />}
        {current === 'glossary'    && <div style={{ padding: '40px' }}><MedicalGlossary /></div>}
        {current === 'marketplace' && <MarketplacePlaceholder />}
        {current === 'profile'     && <ProfilePlaceholder />}
      </main>

      <BottomNav current={current} onNavigate={setCurrent} />
      <FloatingActions navHeight={BOTTOM_NAV_HEIGHT} />
    </div>
  )
}

export default ResourcesLanding
