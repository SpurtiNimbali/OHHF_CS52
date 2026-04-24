import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const COLOR_NAVY = '#0A2E5C'
const FONT_UI = 'Montserrat, sans-serif' as const

function randomUsername() {
  const nouns = [
    'otter',
    'robin',
    'panda',
    'fox',
    'koala',
    'sparrow',
    'turtle',
    'seal',
    'lion',
    'tiger',
    'bear',
    'wolf',
    'rabbit',
    'cat',
    'dog',
    'horse',
    'sheep',
    'cow',
    'pig',
    'duck',
    'goose',
    'peacock',
    'parrot',
    'zebra',
    'hippo',
    'rhino',
  ] as const

  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(100 + Math.random() * 900)
  return `${noun}${num}`
}

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

type SignUpStep = 'username' | 'security'

export function SignUpScreen() {
  const navigate = useNavigate()
  const generated = useMemo(() => randomUsername(), [])
  const [username, setUsername] = useState(generated)
  const [step, setStep] = useState<SignUpStep>('username')
  const [usernameSaved, setUsernameSaved] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [securityQuestion, setSecurityQuestion] = useState("What is your favorite teacher's last name?")
  const [securityAnswer, setSecurityAnswer] = useState('')

  const canContinueUsername = username.trim().length > 0 && !isWorking
  const canContinueSecurity = securityAnswer.trim().length > 0 && !isWorking

  function formatSupabaseishError(e: unknown): string {
    if (!e) return 'Something went wrong. Please try again.'
    if (e instanceof Error) return e.message || 'Something went wrong. Please try again.'

    // Supabase/PostgREST errors are often plain objects.
    if (typeof e === 'object') {
      const maybe = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
      const parts = [maybe.message, maybe.details, maybe.hint, maybe.code]
        .filter((p) => typeof p === 'string' && p.trim().length > 0) as string[]
      if (parts.length) return parts.join(' — ')
      try {
        return JSON.stringify(e)
      } catch {
        // ignore
      }
    }

    return String(e)
  }

  async function ensureAuthedUserId(): Promise<string> {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession()
    if (sessionError) throw sessionError
    if (sessionData.session?.user?.id) return sessionData.session.user.id

    const { data: anonData, error: anonError } =
      await supabase.auth.signInAnonymously()
    if (anonError) throw anonError
    const uid = anonData.user?.id
    if (!uid) throw new Error('Could not create a user session.')
    return uid
  }

  async function claimUsernameAndContinue() {
    const desired = username.trim()
    if (!desired) return

    setIsWorking(true)
    setError(null)

    try {
      const uid = await ensureAuthedUserId()

      // Check username availability
      const { data: existing, error: selectError } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', desired)
        .maybeSingle()

      if (selectError) throw selectError
      if (existing && existing.id !== uid) {
        setError('That username is already taken. Please choose another.')
        return
      }

      // If this user already has a row, update it; otherwise insert a new one.
      const { data: existingForUser, error: existingForUserError } = await supabase
        .from('users')
        .select('id')
        .eq('id', uid)
        .maybeSingle()

      if (existingForUserError) throw existingForUserError

      if (existingForUser) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ username: desired })
          .eq('id', uid)
        if (updateError) throw updateError
      } else {
        // Claim username (insert row) tied to the authenticated user id.
        // Assumes `users.id` is a uuid that matches `auth.uid()` and `users.username` is unique.
        const { error: insertError } = await supabase
          .from('users')
          .insert([{ id: uid, username: desired }])

        if (insertError) {
          // If a concurrent insert happened between select+insert, treat as "taken".
          const msg = insertError.message?.toLowerCase?.() ?? ''
          if (msg.includes('duplicate') || msg.includes('unique')) {
            setError('That username is already taken. Please choose another.')
            return
          }
          throw insertError
        }
      }

      setUsernameSaved(true)
      setStep('security')
    } catch (e) {
      setError(formatSupabaseishError(e))
    } finally {
      setIsWorking(false)
    }
  }

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
          Create your account
        </h1>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.35, fontWeight: 500, color: 'rgba(10, 46, 92, 0.78)' }}>
          We never collect your real name. Your username is only used to identify your account.
        </p>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
          {step === 'username' && (
            <>
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError(null)
                }}
                placeholder="Username"
                aria-label="Username"
                autoComplete="off"
                style={inputStyle}
              />
              {error && (
                <div
                  role="alert"
                  style={{
                    width: '100%',
                    maxWidth: 520,
                    margin: '4px auto 0',
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(220, 38, 38, 0.08)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    color: '#991B1B',
                    textAlign: 'left',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {error}
                </div>
              )}
            </>
          )}

          {step === 'security' && (
            <>
              <div
                style={{
                  width: '100%',
                  maxWidth: 520,
                  margin: '0 auto',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(10, 46, 92, 0.06)',
                  border: '1px solid rgba(10, 46, 92, 0.14)',
                  textAlign: 'left',
                  fontSize: 14,
                  fontWeight: 650,
                }}
              >
                Username: <span style={{ fontWeight: 800 }}>{username.trim()}</span>
              </div>

              <select
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value)}
                aria-label="Security question"
                style={{
                  ...inputStyle,
                  appearance: 'none',
                  background: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                <option value="What is your favorite teacher's last name?">
                  What is your favorite teacher&apos;s last name?
                </option>
                <option value="What city were you born in?">What city were you born in?</option>
                <option value="What is the name of your first pet?">What is the name of your first pet?</option>
              </select>

              <input
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Security answer"
                aria-label="Security answer"
                autoComplete="off"
                style={inputStyle}
              />

              {error && (
                <div
                  role="alert"
                  style={{
                    width: '100%',
                    maxWidth: 520,
                    margin: '4px auto 0',
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(220, 38, 38, 0.08)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    color: '#991B1B',
                    textAlign: 'left',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {error}
                </div>
              )}
            </>
          )}
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
            disabled={step === 'username' ? !canContinueUsername : !canContinueSecurity}
            onClick={() => {
              if (step === 'username') {
                void claimUsernameAndContinue()
                return
              }

              // Security questions complete. For now, proceed to onboarding.
              // TODO: store security question/answer in Supabase (preferably hashed answer).
              navigate('/onboarding')
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
              cursor:
                step === 'username'
                  ? canContinueUsername
                    ? 'pointer'
                    : 'not-allowed'
                  : canContinueSecurity
                    ? 'pointer'
                    : 'not-allowed',
              minWidth: 168,
              boxSizing: 'border-box',
              opacity:
                step === 'username'
                  ? canContinueUsername
                    ? 1
                    : 0.45
                  : canContinueSecurity
                    ? 1
                    : 0.45,
              boxShadow: '0 10px 28px rgba(10, 46, 92, 0.18), 0 2px 6px rgba(10, 46, 92, 0.08)',
            }}
          >
            {step === 'username' ? (isWorking ? 'Checking...' : 'Continue') : 'Continue'}
          </button>
        </div>

        {/* Guardrail: if we failed to insert username for some reason, don't proceed */}
        {step === 'security' && !usernameSaved && (
          <div
            role="alert"
            style={{
              width: '100%',
              maxWidth: 560,
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(245, 158, 11, 0.10)',
              border: '1px solid rgba(245, 158, 11, 0.28)',
              color: '#92400E',
              textAlign: 'left',
              fontSize: 14,
              fontWeight: 650,
            }}
          >
            We couldn&apos;t confirm your username was saved yet. Go back and try again.
          </div>
        )}
      </div>
    </main>
  )
}

