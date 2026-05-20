import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import { isServerSupabaseConfigured, supabase } from '../lib/supabase.js'

const router = Router()

function normalizeAnswer(raw: string): string {
  return raw.trim().toLowerCase()
}

function jsonError(res: Response, status: number, message: string) {
  return res.status(status).json({ ok: false, message })
}

router.post('/sign-in-preview', async (req: Request, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return jsonError(
      res,
      503,
      'Server Supabase is not configured. Add SUPABASE_SECRET_KEY to .env and run npm run server:dev',
    )
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
  if (!username) {
    return jsonError(res, 400, 'Enter a username to continue.')
  }

  const { data, error } = await supabase.rpc('get_user_sign_in_preview', {
    p_username: username,
  })

  if (error) {
    console.error('[auth/sign-in-preview]', error)
    const msg = error.message?.toLowerCase().includes('get_user_sign_in_preview')
      ? 'Sign-in is not set up in the project yet. Run the SQL in supabase/migrations for get_user_sign_in_preview.'
      : error.message
    return jsonError(res, 500, msg)
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

  if (!row?.user_id) {
    return jsonError(res, 404, 'We could not find that username.')
  }

  return res.json({ ok: true, preview: row })
})

router.post('/sign-in', async (req: Request, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return jsonError(
      res,
      503,
      'Server Supabase is not configured. Add SUPABASE_SECRET_KEY to .env and run npm run server:dev',
    )
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
  const answer = typeof req.body?.answer === 'string' ? req.body.answer : ''
  const questionIdRaw = req.body?.question_id
  const questionId =
    typeof questionIdRaw === 'number' && Number.isFinite(questionIdRaw)
      ? questionIdRaw
      : typeof questionIdRaw === 'string' && questionIdRaw.trim().length > 0
        ? Number(questionIdRaw)
        : NaN

  if (!username || !answer || !Number.isFinite(questionId)) {
    return jsonError(res, 200, 'Incorrect answer')
  }

  const { data: previewRows, error: previewErr } = await supabase.rpc('get_user_sign_in_preview', {
    p_username: username,
  })
  if (previewErr) {
    console.error('[auth/sign-in] preview', previewErr)
    return jsonError(res, 200, 'Sign-in failed. Try again.')
  }

  const preview = Array.isArray(previewRows) ? previewRows[0] : previewRows
  const userId =
    preview && typeof preview === 'object' && 'user_id' in preview
      ? (preview as { user_id: string }).user_id
      : null
  if (!userId) {
    return jsonError(res, 200, 'Incorrect answer')
  }

  const { data: row, error: rowErr } = await supabase
    .from('users')
    .select(
      'security_q1_id, security_q1answer_hash, security_q2_id, security_q2answer_hash, security_q3_id, security_q3answer_hash',
    )
    .eq('id', userId)
    .maybeSingle()

  if (rowErr || !row) {
    return jsonError(res, 200, 'Incorrect answer')
  }

  const q1Matches = row.security_q1_id === questionId
  const q2Matches = row.security_q2_id === questionId
  const q3Matches = row.security_q3_id === questionId

  const expectedHash = q1Matches
    ? row.security_q1answer_hash
    : q2Matches
      ? row.security_q2answer_hash
      : q3Matches
        ? row.security_q3answer_hash
        : null

  if (!expectedHash || !bcrypt.compareSync(normalizeAnswer(answer), expectedHash)) {
    return jsonError(res, 200, 'Incorrect answer')
  }

  const internalEmail = `${userId}@example.com`
  const { data: authUser, error: getUserErr } = await supabase.auth.admin.getUserById(userId)
  if (getUserErr) {
    console.error('[auth/sign-in] getUser', getUserErr)
    return jsonError(res, 200, 'Sign-in failed. Try again.')
  }

  const existingEmail = authUser.user?.email?.trim()
  const emailForLink = existingEmail && existingEmail.length > 0 ? existingEmail : internalEmail

  if (!existingEmail) {
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      email: internalEmail,
      email_confirm: true,
    })
    if (updErr) {
      console.error('[auth/sign-in] updateUser', updErr)
      return jsonError(res, 200, 'Sign-in failed. Try again.')
    }
  }

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: emailForLink,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('[auth/sign-in] generateLink', linkErr)
    return jsonError(res, 200, 'Sign-in failed. Try again.')
  }

  const hashedToken = linkData.properties.hashed_token
  let session =
    (
      await supabase.auth.verifyOtp({
        token_hash: hashedToken,
        type: 'email',
      })
    ).data.session ?? null

  if (!session) {
    session =
      (
        await supabase.auth.verifyOtp({
          token_hash: hashedToken,
          type: 'magiclink',
        })
      ).data.session ?? null
  }

  if (!session?.access_token || !session.refresh_token) {
    return jsonError(res, 200, 'Sign-in failed. Try again.')
  }

  return res.json({
    ok: true,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
})

router.post('/anonymous-session', async (_req: Request, res: Response) => {
  if (!isServerSupabaseConfigured) {
    return jsonError(res, 503, 'Server Supabase is not configured.')
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.session?.access_token || !data.session.refresh_token) {
    console.error('[auth/anonymous-session]', error)
    return jsonError(res, 500, 'Could not create a user session.')
  }

  return res.json({
    ok: true,
    user_id: data.user?.id ?? null,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
})

export default router
