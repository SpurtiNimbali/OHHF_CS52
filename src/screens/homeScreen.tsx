import { Link } from 'react-router-dom'

const COLOR_NAVY = '#0A2E5C'
const FONT_UI = 'Montserrat, sans-serif' as const

export function HomeScreen() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#EEF1F4',
        color: COLOR_NAVY,
        fontFamily: FONT_UI,
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.1, fontWeight: 800, letterSpacing: -0.5 }}>
        Home (coming soon)
      </h1>
      <p style={{ margin: 0, marginTop: 10, maxWidth: 560, fontSize: 18, lineHeight: 1.35, fontWeight: 500, color: 'rgba(10, 46, 92, 0.78)' }}>
        This is a placeholder screen so your router flow works end-to-end.
      </p>
      <Link
        to="/resources"
        style={{
          marginTop: 18,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 28px',
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 650,
          fontFamily: FONT_UI,
          cursor: 'pointer',
          minWidth: 168,
          boxSizing: 'border-box',
          textDecoration: 'none',
          border: '2px solid rgba(10, 46, 92, 0.35)',
          color: '#fff',
          background: COLOR_NAVY,
        }}
      >
        View Resources
      </Link>
      <Link
        to="/"
        style={{
          marginTop: 18,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 28px',
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 650,
          fontFamily: FONT_UI,
          cursor: 'pointer',
          minWidth: 168,
          boxSizing: 'border-box',
          textDecoration: 'none',
          border: '2px solid rgba(10, 46, 92, 0.35)',
          color: COLOR_NAVY,
          background: 'transparent',
        }}
      >
        Back to auth
      </Link>
    </main>
  )
}

