import React from 'react'
import { Link } from 'react-router-dom'

const COLOR_NAVY = '#0A2E5C'
const FONT_UI = 'Montserrat, sans-serif' as const

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
  boxSizing: 'border-box',
  background: '#EEF1F4',
  textAlign: 'center',
  fontFamily: FONT_UI,
  color: COLOR_NAVY,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 42,
  lineHeight: 1.08,
  fontWeight: 800,
  letterSpacing: -0.6,
}

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  marginTop: 10,
  maxWidth: 560,
  fontSize: 18,
  lineHeight: 1.35,
  fontWeight: 500,
  color: 'rgba(10, 46, 92, 0.78)',
}

const buttonBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '12px 26px',
  borderRadius: 12,
  fontSize: 16,
  fontFamily: FONT_UI,
  fontWeight: 650,
  cursor: 'pointer',
  minWidth: 180,
  textDecoration: 'none',
  boxSizing: 'border-box',
}

export function AuthLandingScreen() {
  return (
    <main style={containerStyle}>
      <h1 style={titleStyle}>Welcome back</h1>
      <p style={subtitleStyle}>
        Sign in to continue, or create an account if this is your first time.
      </p>

      <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          to="/sign-in"
          style={{
            ...buttonBase,
            background: COLOR_NAVY,
            color: '#FFFFFF',
            boxShadow: '0 10px 28px rgba(10, 46, 92, 0.18), 0 2px 6px rgba(10, 46, 92, 0.08)',
            border: 'none',
          }}
        >
          Sign in
        </Link>
        <Link
          to="/sign-up"
          style={{
            ...buttonBase,
            background: 'transparent',
            color: COLOR_NAVY,
            border: '2px solid rgba(10, 46, 92, 0.35)',
          }}
        >
          Sign up
        </Link>
      </div>
    </main>
  )
}

