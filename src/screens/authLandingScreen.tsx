import React from 'react'
import { Link } from 'react-router-dom'
import welcomeHeart from '../assets/images/OHHF_heart.png'

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
      <div
        aria-hidden="true"
        style={{
          width: 132,
          height: 132,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background:
            'radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.95), rgba(232, 223, 242, 0.92) 45%, rgba(216, 200, 238, 0.9) 100%)',
          boxShadow: '0 12px 26px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.06)',
          marginBottom: 10,
        }}
      >
        <img
          src={welcomeHeart}
          alt=""
          style={{
            width: 84,
            height: 84,
            objectFit: 'contain',
            filter: 'drop-shadow(0 6px 10px rgba(15, 23, 42, 0.12))',
          }}
        />
      </div>
      <h1 style={titleStyle}>Insert app name here</h1>
      <p style={subtitleStyle}>
        Sign in to continue, or sign up if this is your first time.
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

