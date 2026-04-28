import { useState } from 'react'

interface NavCardProps {
  title: string
  icon: string
  onClick: () => void
  description?: string
  accentColor?: string
}

const NavCard: React.FC<NavCardProps> = ({ title, icon, onClick, description, accentColor = '#667eea' }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '40px 32px',
        boxShadow: isHovered
          ? `0 24px 60px ${accentColor}35`
          : '0 8px 30px rgba(0, 0, 0, 0.08)',
        border: `3px solid ${isHovered ? accentColor : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        minHeight: '260px',
        justifyContent: 'center',
        transform: isHovered ? 'translateY(-12px) scale(1.02)' : 'translateY(0) scale(1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Colored top accent bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '8px',
        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`,
      }} />
      
      {/* Icon with colored background circle */}
      <div style={{
        fontSize: '64px',
        marginBottom: '20px',
        position: 'relative',
        transition: 'transform 0.3s ease',
        transform: isHovered ? 'scale(1.15)' : 'scale(1)',
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100px',
          height: '100px',
          background: `${accentColor}20`,
          borderRadius: '50%',
          transition: 'all 0.3s ease',
        }} />
        <span style={{ position: 'relative', zIndex: 1 }}>{icon}</span>
      </div>

      <h3 style={{
        margin: '0 0 12px 0',
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#1a202c',
      }}>
        {title}
      </h3>

      {description && (
        <p style={{
          margin: '0',
          fontSize: '1rem',
          color: '#4a5568',
          lineHeight: '1.6',
        }}>
          {description}
        </p>
      )}

      {/* Arrow indicator */}
      <div style={{
        marginTop: '24px',
        fontSize: '1.8rem',
        color: accentColor,
        opacity: isHovered ? 1 : 0.4,
        transition: 'all 0.3s ease',
        transform: isHovered ? 'translateX(8px)' : 'translateX(0)',
      }}>
        →
      </div>
    </div>
  )
}

export default NavCard