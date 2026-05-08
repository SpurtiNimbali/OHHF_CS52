import { CARDEA_MUTED, CARDEA_NAVY } from '../../ui/cardeaTokens'

type GlossaryScreenHeadingProps = {
  title: string
  subtitle: string
}

export function GlossaryScreenHeading({ title, subtitle }: GlossaryScreenHeadingProps) {
  return (
    <header style={{ padding: '8px 0 28px' }}>
      <h1
        style={{
          fontSize: 'clamp(1.5rem, 4vw, 2rem)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: CARDEA_NAVY,
          margin: '0 0 12px',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: '1rem',
          lineHeight: 1.6,
          color: CARDEA_MUTED,
          margin: 0,
          fontWeight: 400,
        }}
      >
        {subtitle}
      </p>
    </header>
  )
}
