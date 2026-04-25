import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CustomSelect } from '../components/CustomSelect'
import { securityQuestionLabel, type SecurityQuestionId } from '../constants/securityQuestions'
import { supabase } from '../lib/supabaseClient'

const COLOR_NAVY = '#0A2E5C'
const FONT_UI = 'Montserrat, sans-serif' as const

const SECURITY_ANSWER_MIN_LENGTH = 3

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

const fieldColumnStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  alignItems: 'stretch',
  boxSizing: 'border-box',
}

type SignInStep = 'username' | 'security'

function localSecurityAnswerError(raw: string): string | null {
  const t = raw.trim()
  if (t.length < SECURITY_ANSWER_MIN_LENGTH) {
    return 'Your answer must be at least 3 characters long.'
  }
  return null
}

function formatSupabaseishError(e: unknown): string {
  if (!e) return 'Something went wrong. Please try again.'
  if (e instanceof Error) return e.message || 'Something went wrong. Please try again.'

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

export function SignInScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState<SignInStep>('username')
  const [username, setUsername] = useState('')
  const [availableQuestionIds, setAvailableQuestionIds] = useState<SecurityQuestionId[]>([])
  const [selectedQuestionId, setSelectedQuestionId] = useState<SecurityQuestionId | null>(null)
  const [securityAnswer, setSecurityAnswer] = useState('')

  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<React.ReactNode | null>(null)
  const [securityAnswerBegan, setSecurityAnswerBegan] = useState(false)

  const canContinueUsername = username.trim().length > 0 && !isWorking
  const securityAnswerError = step === 'security' ? localSecurityAnswerError(securityAnswer) : null
  const canContinueSecurity =
    step === 'security' &&
    selectedQuestionId != null &&
    securityAnswerError === null &&
    securityAnswer.trim().length > 0 &&
    !isWorking

  async function loadQuestionAndMoveToSecurity() {
    const u = username.trim()
    if (!u) {
      setError('Enter a username to continue.')
      return
    }
    setIsWorking(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_user_sign_in_preview', {
        p_username: u,
      })
      if (rpcError) {
        const full = formatSupabaseishError(rpcError)
        if (full.toLowerCase().includes('get_user_sign_in_preview')) {
          setError('Sign-in is not set up in the project yet. Run the SQL in supabase/migrations for get_user_sign_in_preview.')
        } else {
          setError(full)
        }
        return
      }
      const row = (Array.isArray(data) ? data[0] : data) as
        | {
            user_id?: string
            security_q1_id?: number | null
            security_q2_id?: number | null
            security_q3_id?: number | null
          }
        | null
        | undefined
      const uid = row?.user_id
      if (!uid) {
        setError('We could not find that username.')
        return
      }

      const ids = [row?.security_q1_id, row?.security_q2_id, row?.security_q3_id]
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        .map((v) => v as SecurityQuestionId)
        .filter((v) => securityQuestionLabel(v).trim().length > 0)

      const uniqueIds = Array.from(new Set(ids))

      if (uniqueIds.length === 0) {
        setError('That account is not set up for sign-in yet. Finish creating your account, or use a different username.')
        return
      }

      setAvailableQuestionIds(uniqueIds)
      setSelectedQuestionId(uniqueIds[0] ?? null)
      setStep('security')
      setSecurityAnswer('')
      setSecurityAnswerBegan(false)
    } catch (e) {
      setError(formatSupabaseishError(e))
    } finally {
      setIsWorking(false)
    }
  }

  async function signInWithAnswer() {
    if (localSecurityAnswerError(securityAnswer)) {
      return
    }
    if (!selectedQuestionId) {
      setError('Missing sign-in data. Go back and enter your username again.')
      return
    }
    setIsWorking(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('sign-in-with-security', {
        body: { username: username.trim(), answer: securityAnswer, question_id: selectedQuestionId },
      })
      if (fnError) {
        setError(
          'Sign-in service is unavailable. Deploy the Edge Function `sign-in-with-security` from this repo (see supabase/functions) and ensure supabase/config.toml sets verify_jwt = false for it.',
        )
        return
      }
      const result = data as { ok?: boolean; hashed_token?: string; message?: string } | null
      if (!result?.ok) {
        setError(result?.message ?? 'Incorrect answer')
        return
      }
      if (!result.hashed_token) {
        setError('Sign-in failed. Try again.')
        return
      }
      let verifyErr = (
        await supabase.auth.verifyOtp({
          token_hash: result.hashed_token,
          type: 'email',
        })
      ).error
      if (verifyErr) {
        verifyErr = (
          await supabase.auth.verifyOtp({
            token_hash: result.hashed_token,
            type: 'magiclink',
          })
        ).error
      }
      if (verifyErr) {
        setError(formatSupabaseishError(verifyErr))
        return
      }
      navigate('/home')
    } catch (e) {
      setError(formatSupabaseishError(e))
    } finally {
      setIsWorking(false)
    }
  }

  function handleBack() {
    setError(null)
    if (step === 'security') {
      setStep('username')
      setAvailableQuestionIds([])
      setSelectedQuestionId(null)
      setSecurityAnswer('')
      setSecurityAnswerBegan(false)
    }
  }

  const primaryOnClick = () => {
    if (step === 'username') {
      void loadQuestionAndMoveToSecurity()
    } else {
      void signInWithAnswer()
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
          Sign in
        </h1>
        {step === 'username' ? (
          <p
            style={{
              margin: 0,
              fontSize: 18,
              lineHeight: 1.35,
              fontWeight: 500,
              color: 'rgba(10, 46, 92, 0.78)',
            }}
          >
            Enter your username.
          </p>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 18,
              lineHeight: 1.35,
              fontWeight: 500,
              color: 'rgba(10, 46, 92, 0.78)',
            }}
          >
            Choose a security question to answer. 
          </p>
        )}

        <div style={fieldColumnStyle}>
          {step === 'username' && (
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Username"
              aria-label="Username"
              autoComplete="username"
              style={inputStyle}
            />
          )}

          {step === 'security' && availableQuestionIds.length > 0 && (
            <CustomSelect<SecurityQuestionId>
              label="Security question"
              placeholder="Select a question"
              value={selectedQuestionId}
              onChange={(next) => {
                setSelectedQuestionId(next)
                if (error) setError(null)
              }}
              allowClear={false}
              variant="compact"
              options={availableQuestionIds.map((id) => ({
                value: id,
                label: securityQuestionLabel(id),
              }))}
            />
          )}

          {step === 'security' && selectedQuestionId != null && (
            <input
              value={securityAnswer}
              onChange={(e) => {
                if (!securityAnswerBegan) setSecurityAnswerBegan(true)
                setSecurityAnswer(e.target.value)
                if (error) setError(null)
              }}
              onBlur={() => setSecurityAnswerBegan(true)}
              placeholder="Your answer"
              aria-label="Security answer"
              autoComplete="off"
              style={inputStyle}
            />
          )}

          {error != null && (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.4,
                fontWeight: 600,
                textAlign: 'left',
                color: '#9B1C31',
                width: '100%',
                maxWidth: 520,
              }}
              role="alert"
            >
              {error}
            </p>
          )}

          {step === 'security' && securityAnswerBegan && securityAnswerError != null && error == null && (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.4,
                fontWeight: 600,
                textAlign: 'left',
                color: '#9B1C31',
                width: '100%',
                maxWidth: 520,
              }}
            >
              {securityAnswerError}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          {step === 'username' ? (
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
          ) : (
            <button
              type="button"
              onClick={handleBack}
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
            </button>
          )}
          <button
            type="button"
            disabled={step === 'username' ? !canContinueUsername : !canContinueSecurity}
            onClick={primaryOnClick}
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
                (step === 'username' ? canContinueUsername : canContinueSecurity) && !isWorking
                  ? 'pointer'
                  : 'not-allowed',
              minWidth: 168,
              boxSizing: 'border-box',
              opacity:
                (step === 'username' ? canContinueUsername : canContinueSecurity) && !isWorking
                  ? 1
                  : 0.45,
              boxShadow: '0 10px 28px rgba(10, 46, 92, 0.18), 0 2px 6px rgba(10, 46, 92, 0.08)',
            }}
          >
            {isWorking
              ? step === 'username'
                ? 'Loading...'
                : 'Signing in...'
              : step === 'username'
                ? 'Continue'
                : 'Continue'}
          </button>
        </div>
      </div>
    </main>
  )
}
