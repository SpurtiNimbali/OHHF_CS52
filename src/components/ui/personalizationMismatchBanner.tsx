import type { ReactNode } from 'react'

/** Amber call-out when personalization filters yield no picks (Find Support). */
export function PersonalizationMismatchBanner({
  icon = <span style={{ fontSize: '3rem' }}>✨</span>,
  title,
  description,
}: {
  icon?: ReactNode
  title: string
  description: string
}) {
  return (
    <div
      style={{
        background: '#fff8e1',
        border: '2px solid #ffe082',
        borderRadius: '16px',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      {icon}
      <p
        style={{
          color: '#f57f17',
          fontSize: '1.2rem',
          fontWeight: 600,
          marginTop: '12px',
        }}
      >
        {title}
      </p>
      <p style={{ color: '#b45309', fontSize: '0.95rem', marginTop: '8px', lineHeight: 1.5 }}>{description}</p>
    </div>
  )
}
