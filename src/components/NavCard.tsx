import { useState } from 'react'

interface NavCardProps {
  title: string
  icon: string
  onClick: () => void
  description?: string
  accentColor?: string
}

const NavCard: React.FC<NavCardProps> = ({ title, icon, onClick, description }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '40px 32px',
        border: `1.5px solid ${isHovered ? '#577568' : '#c6d9e5'}`,
        boxShadow: isHovered
          ? '0 12px 32px rgba(25, 43, 63, 0.12)'
          : '0 2px 12px rgba(25, 43, 63, 0.06)',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        minHeight: '240px',
        justifyContent: 'center',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: isHovered ? '#577568' : '#c6d9e5',
        borderRadius: '16px 16px 0 0',
        transition: 'background 0.25s ease',
      }} />

      {/* Icon */}
      <div style={{
        fontSize: '48px',
        marginBottom: '20px',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: '#f5f9f9',
        border: '1.5px solid #c6d9e5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.25s ease',
      }}>
        <span>{icon}</span>
      </div>

      <h3 style={{
        margin: '0 0 10px 0',
        fontSize: '1.15rem',
        fontWeight: 700,
        color: '#192b3f',
        fontFamily: 'Inter, system-ui, sans-serif',
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h3>

      {description && (
        <p style={{
          margin: 0,
          fontSize: '0.9rem',
          color: '#acb7a8',
          lineHeight: 1.6,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          {description}
        </p>
      )}

      <div style={{
        marginTop: '20px',
        fontSize: '1.2rem',
        color: '#577568',
        opacity: isHovered ? 1 : 0.4,
        transition: 'all 0.25s ease',
        transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
      }}>
        →
      </div>
    </div>
  )
}

export default NavCard
