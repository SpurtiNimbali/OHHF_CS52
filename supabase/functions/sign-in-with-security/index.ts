/**
 * Username + first security answer → session (JWT) for that auth user.
 * Supabase Auth requires an internal email for generateLink/verifyOtp; users never see it.
 *
 * Deploy: supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... (if not auto-injected)
 *         supabase functions deploy sign-in-with-security
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'
import bcrypt from 'npm:bcryptjs@2.4.3'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeAnswer(raw: string): string {
  return raw.trim().toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return new Response(
        JSON.stringify({
          ok: false,
          message: 'Sign-in service is not configured (missing secrets).',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = (await req.json()) as { username?: string; answer?: string; question_id?: unknown }
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const answer = typeof body.answer === 'string' ? body.answer : ''
    const questionId =
      typeof body.question_id === 'number' && Number.isFinite(body.question_id)
        ? body.question_id
        : typeof body.question_id === 'string' && body.question_id.trim().length > 0
          ? Number(body.question_id)
          : NaN

    if (!username || !answer || !Number.isFinite(questionId)) {
      return new Response(JSON.stringify({ ok: false, message: 'Incorrect answer' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: previewRows, error: previewErr } = await admin.rpc('get_user_sign_in_preview', {
      p_username: username,
    })
    if (previewErr) {
      console.error(previewErr)
      return new Response(JSON.stringify({ ok: false, message: 'Sign-in failed. Try again.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const preview = Array.isArray(previewRows) ? previewRows[0] : previewRows
    const userId =
      preview && typeof preview === 'object' && 'user_id' in preview
        ? (preview as { user_id: string }).user_id
        : null
    if (!userId) {
      return new Response(JSON.stringify({ ok: false, message: 'Incorrect answer' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: row, error: rowErr } = await admin
      .from('users')
      .select(
        'security_q1_id, security_q1answer_hash, security_q2_id, security_q2answer_hash, security_q3_id, security_q3answer_hash',
      )
      .eq('id', userId)
      .maybeSingle()

    if (rowErr || !row) {
      return new Response(JSON.stringify({ ok: false, message: 'Incorrect answer' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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

    if (!expectedHash) {
      return new Response(JSON.stringify({ ok: false, message: 'Incorrect answer' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const match = bcrypt.compareSync(normalizeAnswer(answer), expectedHash)
    if (!match) {
      return new Response(JSON.stringify({ ok: false, message: 'Incorrect answer' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // GoTrue accepts this reserved test domain; mail is never sent. Users never see it.
    const internalEmail = `${userId}@example.com`
    const { data: authUser, error: getUserErr } = await admin.auth.admin.getUserById(userId)
    if (getUserErr) {
      console.error(getUserErr)
      return new Response(JSON.stringify({ ok: false, message: 'Sign-in failed. Try again.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const existingEmail = authUser.user?.email?.trim()
    const emailForLink = existingEmail && existingEmail.length > 0 ? existingEmail : internalEmail

    if (!existingEmail) {
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        email: internalEmail,
        email_confirm: true,
      })
      if (updErr) {
        console.error(updErr)
        return new Response(JSON.stringify({ ok: false, message: 'Sign-in failed. Try again.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: emailForLink,
    })
    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error(linkErr)
      return new Response(JSON.stringify({ ok: false, message: 'Sign-in failed. Try again.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ ok: true, hashed_token: linkData.properties.hashed_token }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, message: 'Sign-in failed. Try again.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
