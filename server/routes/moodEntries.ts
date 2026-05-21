import { Router, type Request, type Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getUserIdFromRequest } from '../lib/authFromRequest.js'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const limit = Math.min(Number(req.query.limit) || 10, 50)

  const { data, error } = await supabase
    .from('mood_entries')
    .select('id, user_id, mood, if_chat, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[mood-entries] fetch error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({ entries: data ?? [] })
})

router.post('/', async (req: Request, res: Response) => {
  try {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const { mood } = req.body as { mood?: string }
  if (!mood || typeof mood !== 'string' || !mood.trim()) {
    return res.status(400).json({ error: 'mood is required' })
  }

  const { data, error } = await supabase
    .from('mood_entries')
    .insert({
      user_id: userId,
      mood: mood.trim(),
      if_chat: false,
      timestamp: new Date().toISOString(),
    })
    .select('id, user_id, mood, if_chat, timestamp')
    .single()

  if (error) {
    console.error('[mood-entries] insert error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json({ entry: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    console.error('[mood-entries] POST error:', e)
    return res.status(500).json({ error: message })
  }
})

router.patch('/:id/if-chat', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const entryId = req.params.id
  if (!entryId) {
    return res.status(400).json({ error: 'entry id is required' })
  }

  const { error } = await supabase
    .from('mood_entries')
    .update({ if_chat: true })
    .eq('id', entryId)
    .eq('user_id', userId)

  if (error) {
    console.error('[mood-entries] update error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({ ok: true })
})

export default router
