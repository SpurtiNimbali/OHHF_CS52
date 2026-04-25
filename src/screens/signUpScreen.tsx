import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CustomSelect } from '../components/CustomSelect'
import {
  SECURITY_QUESTIONS,
  type SecurityQuestionId,
} from '../constants/securityQuestions'
import { hashSecurityAnswerBcrypt } from '../lib/securityAnswerBcrypt'
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

const USERNAME_MAX_LENGTH = 30
const USERNAME_TOO_LONG_MESSAGE = 'Usernames can be at most 30 characters.'

const signInLinkInAlertStyle: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'underline',
  fontFamily: 'inherit',
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

/** Centered column so inputs and summary boxes share the same width and x-position. */
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

const SECURITY_STEPS = 3
const SECURITY_ANSWER_MIN_LENGTH = 3

const SECURITY_INTRO =
  "To sign in to the app in the future, you will answer these security questions."

const usernameSummaryStyle: React.CSSProperties = {
  width: '100%',
  margin: 0,
  padding: '10px 12px',
  borderRadius: 12,
  background: 'rgba(10, 46, 92, 0.06)',
  border: '2px solid rgba(10, 46, 92, 0.14)',
  textAlign: 'left',
  fontSize: 14,
  fontWeight: 650,
  boxSizing: 'border-box',
}

function localUsernameValidationError(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return 'Your username cannot be empty. Enter a username to continue.'
  if (/\s/.test(raw)) return 'Usernames cannot contain spaces. Remove spaces and try again.'
  if (trimmed.length > USERNAME_MAX_LENGTH) return USERNAME_TOO_LONG_MESSAGE
  return null
}

function localSecurityAnswerError(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.length < SECURITY_ANSWER_MIN_LENGTH) {
    return 'Your answer must be at least 3 characters long.'
  }
  return null
}

/** PostgREST may return a bare boolean or a single-key object depending on version. */
function interpretUsernameAvailabilityRpc(data: unknown): boolean | null {
  if (typeof data === 'boolean') return data
  if (data === null || data === undefined) return null
  if (Array.isArray(data)) {
    if (data.length === 1) return interpretUsernameAvailabilityRpc(data[0])
    return null
  }
  if (typeof data === 'object') {
    const v = Object.values(data as Record<string, unknown>).find((x) => typeof x === 'boolean')
    return typeof v === 'boolean' ? v : null
  }
  return null
}

type SignUpStep = 'username' | 'security'

export function SignUpScreen() {
  const navigate = useNavigate()
  const [username, setUsername] = useState(() => randomUsername())
  const [step, setStep] = useState<SignUpStep>('username')
  const [usernameSaved, setUsernameSaved] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<React.ReactNode | null>(null)

  const [securityQaCompleted, setSecurityQaCompleted] = useState<
    { questionId: SecurityQuestionId; answer: string }[]
  >([])
  const [draftSecurityQuestionId, setDraftSecurityQuestionId] = useState<SecurityQuestionId>(
    SECURITY_QUESTIONS[0].id,
  )
  const [draftSecurityAnswer, setDraftSecurityAnswer] = useState('')
  /** Do not show answer validation until the field is focused and the user has changed the value. */
  const [securityAnswerFocused, setSecurityAnswerFocused] = useState(false)
  const [securityAnswerBegan, setSecurityAnswerBegan] = useState(false)

  const usernameClientMessage = step === 'username' ? localUsernameValidationError(username) : null
  const usernameFieldAlert = error ?? usernameClientMessage
  const canContinueUsername = usernameClientMessage === null && !isWorking
  const shouldShowSecurityAnswerError =
    step === 'security' &&
    securityAnswerFocused &&
    securityAnswerBegan &&
    localSecurityAnswerError(draftSecurityAnswer) !== null
  const securityAnswerClientMessage =
    shouldShowSecurityAnswerError ? localSecurityAnswerError(draftSecurityAnswer) : null
  const securityFieldAlert = error ?? securityAnswerClientMessage
  const canContinueSecurity =
    localSecurityAnswerError(draftSecurityAnswer) === null && !isWorking

  const securityQuestionOptions = SECURITY_QUESTIONS.filter(
    (q) => !securityQaCompleted.some((done) => done.questionId === q.id),
  )
  const currentSecurityIndex = securityQaCompleted.length + 1

  function handleUsernameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const ignoredKeys = new Set([
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'Tab',
      'Enter',
      'Escape',
    ])
    if (ignoredKeys.has(e.key)) return
    if (e.key.length !== 1) return

    const el = e.currentTarget
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const selectionLen = end - start
    const nextLen = username.length - selectionLen + 1
    if (nextLen > USERNAME_MAX_LENGTH) {
      e.preventDefault()
      setError(USERNAME_TOO_LONG_MESSAGE)
    }
  }

  function handleUsernamePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text')
    const el = e.currentTarget
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const before = username.slice(0, start)
    const after = username.slice(end)
    const room = USERNAME_MAX_LENGTH - before.length - after.length
    if (room <= 0) {
      setError(USERNAME_TOO_LONG_MESSAGE)
      return
    }
    const insert = pasted.slice(0, room)
    const next = before + insert + after
    setUsername(next)
    if (pasted.length > room) {
      setError(USERNAME_TOO_LONG_MESSAGE)
    } else {
      setError(null)
    }
    const caret = start + insert.length
    requestAnimationFrame(() => {
      el.setSelectionRange(caret, caret)
    })
  }

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

  function isUniqueOrUsernameConflict(e: unknown): boolean {
    if (typeof e !== 'object' || e === null) return false
    const o = e as { code?: unknown; message?: unknown }
    if (o.code === '23505') return true
    const m = String(o.message ?? '').toLowerCase()
    return (
      m.includes('duplicate') ||
      m.includes('unique') ||
      m.includes('users_username') ||
      m.includes('username_key')
    )
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
    const clientErr = localUsernameValidationError(username)
    if (clientErr) {
      setError(clientErr)
      return
    }

    const desired = username.trim()

    setIsWorking(true)
    setError(null)

    try {
      const uid = await ensureAuthedUserId()

      // Must use RPC: a client SELECT on `users` cannot see other accounts under typical RLS,
      // so taken names would appear "free". `username_is_available` is SECURITY DEFINER (see supabase/migrations).
      if (!uid) {
        setError('Could not verify your session. Please refresh and try again.')
        return
      }

      // Sign-up is for new accounts only: if this session already has a profile with a username,
      // they should use Sign in, not "create" again.
      const { data: myProfile, error: myProfileError } = await supabase
        .from('users')
        .select('id, username')
        .eq('id', uid)
        .maybeSingle()

      if (myProfileError) throw myProfileError
      if (myProfile?.username && String(myProfile.username).trim().length > 0) {
        const existingUsername = String(myProfile.username).trim()
        setError(
          <>
            You already have an account on this device under the username{' '}
            <span style={{ fontWeight: 800 }}>{existingUsername}</span>.{' '}
            <Link to="/sign-in" style={signInLinkInAlertStyle}>
              Sign in
            </Link>{' '}
            instead of creating a new account.
          </>,
        )
        return
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('username_is_available', {
        p_username: desired,
        p_user_id: uid,
      })

      if (rpcError) throw rpcError

      const available = interpretUsernameAvailabilityRpc(rpcData)
      if (available === null) {
        setError('Could not verify username (unexpected server response). Please try again.')
        return
      }
      if (!available) {
        setError(
          <>
            This username is already taken. An account with that name already exists. If that&apos;s you,{' '}
            <Link to="/sign-in" style={signInLinkInAlertStyle}>
              sign in
            </Link>
            . Otherwise pick a different username.
          </>,
        )
        return
      }

      // If this user already has a row (incomplete signup: no username yet), update it; otherwise insert.
      if (myProfile) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ username: desired })
          .eq('id', uid)
        if (updateError) {
          if (isUniqueOrUsernameConflict(updateError)) {
            setError(
              <>
                This username is already taken. If you already have an account,{' '}
                <Link to="/sign-in" style={signInLinkInAlertStyle}>
                  sign in
                </Link>
                .
              </>,
            )
            return
          }
          throw updateError
        }
      } else {
        // New profile row: `users.id` matches `auth.uid()`; `users.username` should be unique.
        const { error: insertError } = await supabase
          .from('users')
          .insert([{ id: uid, username: desired }])

        if (insertError) {
          if (isUniqueOrUsernameConflict(insertError)) {
            setError(
              <>
                This username is already taken. If you already have an account,{' '}
                <Link to="/sign-in" style={signInLinkInAlertStyle}>
                  sign in
                </Link>
                .
              </>,
            )
            return
          }
          throw insertError
        }
      }

      setUsernameSaved(true)
      setSecurityQaCompleted([])
      setDraftSecurityAnswer('')
      setDraftSecurityQuestionId(SECURITY_QUESTIONS[0].id)
      setSecurityAnswerFocused(false)
      setSecurityAnswerBegan(false)
      setStep('security')
    } catch (e) {
      const full = formatSupabaseishError(e)
      const lower = full.toLowerCase()
      if (
        lower.includes('username_is_available') ||
        lower.includes('schema cache') ||
        lower.includes('could not find the function')
      ) {
        setError(
          'Username check is not available yet. Ask your team to run the SQL migration in supabase/migrations (function username_is_available).',
        )
      } else {
        setError(full)
      }
    } finally {
      setIsWorking(false)
    }
  }

  async function persistSecurityQaAndGoHome(
    completed: { questionId: SecurityQuestionId; answer: string }[],
  ) {
    setIsWorking(true)
    setError(null)
    try {
      const uid = await ensureAuthedUserId()
      const [a1, a2, a3] = completed
      const [h1, h2, h3] = await Promise.all([
        hashSecurityAnswerBcrypt(a1.answer),
        hashSecurityAnswerBcrypt(a2.answer),
        hashSecurityAnswerBcrypt(a3.answer),
      ])
      const { error: upErr } = await supabase
        .from('users')
        .update({
          security_q1_id: a1.questionId,
          security_q1answer_hash: h1,
          security_q2_id: a2.questionId,
          security_q2answer_hash: h2,
          security_q3_id: a3.questionId,
          security_q3answer_hash: h3,
        })
        .eq('id', uid)
      if (upErr) throw upErr
      setSecurityQaCompleted(completed)
      navigate('/onboarding')
    } catch (e) {
      setError(formatSupabaseishError(e))
    } finally {
      setIsWorking(false)
    }
  }

  function handleBackFromSecurity() {
    setError(null)
    if (securityQaCompleted.length === 0) {
      setSecurityAnswerFocused(false)
      setSecurityAnswerBegan(false)
      setStep('username')
      return
    }
    const last = securityQaCompleted[securityQaCompleted.length - 1]
    setSecurityQaCompleted((s) => s.slice(0, -1))
    setDraftSecurityQuestionId(last.questionId)
    setDraftSecurityAnswer(last.answer)
    const hasPriorAnswer = last.answer.length > 0
    setSecurityAnswerFocused(hasPriorAnswer)
    setSecurityAnswerBegan(hasPriorAnswer)
  }

  function handleSecurityContinue() {
    if (localSecurityAnswerError(draftSecurityAnswer)) {
      return
    }

    const answer = draftSecurityAnswer.trim()
    setError(null)
    const nextCompleted = [
      ...securityQaCompleted,
      { questionId: draftSecurityQuestionId, answer },
    ]

    if (nextCompleted.length < SECURITY_STEPS) {
      setSecurityQaCompleted(nextCompleted)
      setDraftSecurityAnswer('')
      setSecurityAnswerFocused(false)
      setSecurityAnswerBegan(false)
      const usedNext = new Set(nextCompleted.map((r) => r.questionId))
      const avail = SECURITY_QUESTIONS.filter((q) => !usedNext.has(q.id))
      if (avail[0]) setDraftSecurityQuestionId(avail[0].id)
    } else {
      void persistSecurityQaAndGoHome(nextCompleted)
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
            We never collect your real name. Your username is only used to identify your account.
          </p>
        ) : (
          <>
            <p
              style={{
                margin: 0,
                fontSize: 18,
                lineHeight: 1.4,
                fontWeight: 500,
                color: 'rgba(10, 46, 92, 0.88)',
                textAlign: 'center',
                maxWidth: 520,
                width: '100%',
                alignSelf: 'center',
              }}
            >
              {SECURITY_INTRO}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                lineHeight: 1.35,
                fontWeight: 700,
                color: COLOR_NAVY,
              }}
            >
              Security question {currentSecurityIndex} of {SECURITY_STEPS}
            </p>
          </>
        )}

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
          {step === 'username' && (
            <div style={fieldColumnStyle}>
              <input
                value={username}
                maxLength={USERNAME_MAX_LENGTH}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError(null)
                }}
                onKeyDown={handleUsernameKeyDown}
                onPaste={handleUsernamePaste}
                placeholder="Username"
                aria-label="Username"
                aria-invalid={usernameFieldAlert ? true : undefined}
                aria-describedby={usernameFieldAlert ? 'signup-username-feedback' : undefined}
                autoComplete="off"
                style={{ ...inputStyle, maxWidth: '100%' }}
              />
              {usernameFieldAlert && (
                <div
                  id="signup-username-feedback"
                  role="alert"
                  style={{
                    width: '100%',
                    margin: 0,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(220, 38, 38, 0.08)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    color: '#991B1B',
                    textAlign: 'left',
                    fontSize: 14,
                    fontWeight: 600,
                    boxSizing: 'border-box',
                  }}
                >
                  {usernameFieldAlert}
                </div>
              )}
            </div>
          )}

          {step === 'security' && (
            <div style={fieldColumnStyle}>
              <div style={usernameSummaryStyle}>
                Username: <span style={{ fontWeight: 800 }}>{username.trim()}</span>
              </div>

              <div style={{ width: '100%', alignSelf: 'stretch' }} key={securityQaCompleted.length}>
                <CustomSelect<SecurityQuestionId>
                  id={`sign-up-security-question-${securityQaCompleted.length}`}
                  label="Security question"
                  placeholder="Select a question"
                  value={draftSecurityQuestionId}
                  allowClear={false}
                  variant="compact"
                  maxWidth={520}
                  options={securityQuestionOptions.map((q) => ({ value: q.id, label: q.label }))}
                  onChange={(next) => {
                    if (next != null) {
                      setDraftSecurityQuestionId(next)
                      setError(null)
                    }
                  }}
                />
              </div>

              <input
                value={draftSecurityAnswer}
                onFocus={() => setSecurityAnswerFocused(true)}
                onChange={(e) => {
                  setDraftSecurityAnswer(e.target.value)
                  setSecurityAnswerBegan(true)
                  setError(null)
                }}
                placeholder="Security answer"
                aria-label="Security answer"
                aria-invalid={securityFieldAlert ? true : undefined}
                aria-describedby={securityFieldAlert ? 'signup-security-answer-feedback' : undefined}
                autoComplete="off"
                style={{ ...inputStyle, maxWidth: '100%' }}
              />

              {securityFieldAlert && (
                <div
                  id="signup-security-answer-feedback"
                  role="alert"
                  style={{
                    width: '100%',
                    margin: 0,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(220, 38, 38, 0.08)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    color: '#991B1B',
                    textAlign: 'left',
                    fontSize: 14,
                    fontWeight: 600,
                    boxSizing: 'border-box',
                  }}
                >
                  {securityFieldAlert}
                </div>
              )}
            </div>
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
              onClick={handleBackFromSecurity}
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
            onClick={() => {
              if (step === 'username') {
                void claimUsernameAndContinue()
                return
              }
              handleSecurityContinue()
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
            {step === 'username'
              ? isWorking
                ? 'Checking...'
                : 'Continue'
              : isWorking
                ? 'Saving...'
                : 'Continue'}
          </button>
        </div>

        {import.meta.env.DEV && step === 'username' && (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setUsernameSaved(true)
              setSecurityQaCompleted([])
              setDraftSecurityAnswer('')
              setDraftSecurityQuestionId(SECURITY_QUESTIONS[0].id)
              setSecurityAnswerFocused(false)
              setSecurityAnswerBegan(false)
              setStep('security')
            }}
            style={{
              marginTop: 4,
              border: 'none',
              background: 'transparent',
              color: 'rgba(10, 46, 92, 0.6)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: FONT_UI,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Skip to security questions (dev only—remove for production)
          </button>
        )}

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

