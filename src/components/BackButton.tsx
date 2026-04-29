import { useState } from 'react'

interface BackButtonProps {
  onClick: () => void
  text?: string
  style?: React.CSSProperties
}

const BackButton: React.FC<BackButtonProps> = ({ onClick, text = 'Back', style = {} }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '8px 18px',
        backgroundColor: isHovered ? '#192b3f' : 'transparent',
        color: isHovered ? '#f5f9f9' : '#577568',
        border: '1.5px solid #c6d9e5',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        fontFamily: 'Inter, system-ui, sans-serif',
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        ...style,
      }}
    >
      ← {text}
    </button>
  )
}

export default BackButton
