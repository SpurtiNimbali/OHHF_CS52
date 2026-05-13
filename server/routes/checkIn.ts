import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getRecommendations } from '../logic/recommendations.js'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const { user_id, moods } = req.body

  // ── Input validation ──────────────────────────────────────────────────────
  if (!user_id || typeof user_id !== 'string' || user_id.trim() === '') {
    return res.status(400).json({ error: 'user_id is required and must be a non-empty string' })
  }

  if (!Array.isArray(moods) || moods.length === 0) {
    return res.status(400).json({ error: 'moods is required and must be a non-empty array' })
  }

  if (!moods.every(m => typeof m === 'string')) {
    return res.status(400).json({ error: 'every item in moods must be a string' })
  }

  // ── Build recommendations ─────────────────────────────────────────────────
  const recommended_tools = getRecommendations(moods)

  // ── Persist to Supabase ───────────────────────────────────────────────────
  const { error: dbError } = await supabase.from('emotional_checkins').insert({
    user_id: user_id.trim(),
    moods,
    recommended_tools,
  })

  if (dbError) {
    console.error('[check-in] db insert error:', dbError)
    return res.status(500).json({ error: 'Failed to save check-in', details: dbError.message })
  }

  return res.status(200).json({ recommended_tools })
})

export default router
