import { useState } from 'react'

interface NavCardProps {
  title: string
  icon: string
  onClick: () => void
  description?: string
}

const NavCard: React.FC<NavCardProps> = ({ title, icon, onClick, description }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: isHovered
          ? '0 4px 16px rgba(0, 0, 0, 0.15)'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e1e5e9',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        minHeight: '160px',
        justifyContent: 'center',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{
        fontSize: '48px',
        marginBottom: '16px',
        opacity: 0.8
      }}>
        {icon}
      </div>

      <h3 style={{
        margin: '0 0 8px 0',
        fontSize: '18px',
        fontWeight: '600',
        color: '#2c3e50'
      }}>
        {title}
      </h3>

      {description && (
        <p style={{
          margin: '0',
          fontSize: '14px',
          color: '#6c757d',
          lineHeight: '1.4'
        }}>
          {description}
        </p>
      )}
    </div>
  )
}

export default NavCard