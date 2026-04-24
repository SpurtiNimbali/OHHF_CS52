import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const COLOR_NAVY = '#0A2E5C'
const FONT_UI = 'Montserrat, sans-serif' as const

const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  borderRadius: 14,
  padding: '14px 16px',
  fontSize: 16,
  fontWeight: 500,
  border: '2px solid rgba(10, 46, 92, 0.22)',
  background: '#F1F5F9',
  color: COLOR_NAVY,
  fontFamily: FONT_UI,
  boxSizing: 'border-box',
}

export function SignInScreen() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')

  const canContinue = username.trim().length > 0 && securityAnswer.trim().length > 0

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
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.12, fontWeight: 800, letterSpacing: -0.4 }}>
          Sign in
        </h1>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.35, fontWeight: 500, color: 'rgba(10, 46, 92, 0.78)' }}>
          Enter your username and security answer.
        </p>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            aria-label="Username"
            autoComplete="username"
            style={inputStyle}
          />
          <input
            value={securityAnswer}
            onChange={(e) => setSecurityAnswer(e.target.value)}
            placeholder="Security answer"
            aria-label="Security answer"
            autoComplete="off"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <Link
            to="/"
            style={{
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
            Back
          </Link>
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => {
              // TODO: replace with Supabase auth lookup.
              navigate('/home')
            }}
            style={{
              border: 'none',
              background: COLOR_NAVY,
              color: '#FFFFFF',
              padding: '12px 28px',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 650,
              fontFamily: FONT_UI,
              cursor: canContinue ? 'pointer' : 'not-allowed',
              minWidth: 168,
              boxSizing: 'border-box',
              opacity: canContinue ? 1 : 0.45,
              boxShadow: '0 10px 28px rgba(10, 46, 92, 0.18), 0 2px 6px rgba(10, 46, 92, 0.08)',
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  )
}

