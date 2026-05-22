import { Router, type Request, type Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getUserIdFromRequest } from '../lib/authFromRequest.js'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const limit = Math.min(Number(req.query.limit) || 50, 100)

  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, user_id, prompt, entry, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[journal-entries] fetch error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({ entries: data ?? [] })
})

router.post('/', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const { prompt, entry } = req.body as { prompt?: string; entry?: string }
  const trimmedEntry = typeof entry === 'string' ? entry.trim() : ''
  if (!trimmedEntry) {
    return res.status(400).json({ error: 'entry is required' })
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: userId,
      prompt: typeof prompt === 'string' ? prompt.trim() : '',
      entry: trimmedEntry,
      timestamp: new Date().toISOString(),
    })
    .select('id, user_id, prompt, entry, timestamp')
    .single()

  if (error) {
    console.error('[journal-entries] insert error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json({ entry: data })
})

export default router
