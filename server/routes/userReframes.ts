import { Router, type Request, type Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getUserIdFromRequest } from '../lib/authFromRequest.js'

const router = Router()

router.get('/starters', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('user_reframes')
    .select('id, user_id, thought, reframe, timestamp')
    .is('user_id', null)
    .order('timestamp', { ascending: true })
    .limit(6)

  if (error) {
    console.error('[user-reframes] starters error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({ reframes: data ?? [] })
})

router.get('/', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const limit = Math.min(Number(req.query.limit) || 50, 100)

  const { data, error } = await supabase
    .from('user_reframes')
    .select('id, user_id, thought, reframe, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[user-reframes] fetch error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({ reframes: data ?? [] })
})

router.post('/', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const { thought, reframe } = req.body as { thought?: string; reframe?: string }
  const t = typeof thought === 'string' ? thought.trim() : ''
  const r = typeof reframe === 'string' ? reframe.trim() : ''
  if (!t || !r) {
    return res.status(400).json({ error: 'thought and reframe are required' })
  }

  const { data, error } = await supabase
    .from('user_reframes')
    .insert({
      user_id: userId,
      thought: t,
      reframe: r,
      timestamp: new Date().toISOString(),
    })
    .select('id, user_id, thought, reframe, timestamp')
    .single()

  if (error) {
    console.error('[user-reframes] insert error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json({ reframe: data })
})

router.delete('/:id', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
  if (!id) {
    return res.status(400).json({ error: 'id is required' })
  }

  const { data, error } = await supabase
    .from('user_reframes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')

  if (error) {
    console.error('[user-reframes] delete error:', error)
    return res.status(500).json({ error: error.message })
  }

  if (!data?.length) {
    return res.status(404).json({ error: 'Reframe not found' })
  }

  return res.status(204).send()
})

export default router
