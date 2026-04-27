import { useState } from 'react'

interface BackButtonProps {
  onClick: () => void
  text?: string
  style?: React.CSSProperties
}

const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  text = "← Back",
  style = {}
}) => {
  const [isHovered, setIsHovered] = useState(false)

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: isHovered ? '#5a6268' : '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    ...style
  }

  return (
    <button
      onClick={onClick}
      style={buttonStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      ← {text}
    </button>
  )
}

export default BackButton