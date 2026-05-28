import { Router, type Request, type Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getUserIdFromRequest } from '../lib/authFromRequest.js'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const limit = Math.min(Number(req.query.limit) || 200, 500)

  const { data, error } = await supabase
    .from('tool_usage')
    .select('id, user_id, tool_id, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[tool-usage] fetch error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({ usage: data ?? [] })
})

router.post('/', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const { tool_id } = req.body as { tool_id?: string }
  const toolId = typeof tool_id === 'string' ? tool_id.trim() : ''
  if (!toolId) {
    return res.status(400).json({ error: 'tool_id is required' })
  }

  const { data, error } = await supabase
    .from('tool_usage')
    .insert({
      user_id: userId,
      tool_id: toolId,
      timestamp: new Date().toISOString(),
    })
    .select('id, user_id, tool_id, timestamp')
    .single()

  if (error) {
    console.error('[tool-usage] insert error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json({ usage: data })
})

router.delete('/', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const { error } = await supabase.from('tool_usage').delete().eq('user_id', userId)

  if (error) {
    console.error('[tool-usage] clear error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({ ok: true })
})

export default router
