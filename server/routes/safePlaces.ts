import { Router, type Request, type Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getUserIdFromRequest } from '../lib/authFromRequest.js'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const limit = Math.min(Number(req.query.limit) || 20, 50)

  const { data, error } = await supabase
    .from('safe_places')
    .select('id, user_id, name, description, timestamp, image_url')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[safe-places] fetch error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({ places: data ?? [] })
})

router.post('/', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const { name, description, image_url } = req.body as {
    name?: string
    description?: string
    image_url?: string | null
  }
  const n = typeof name === 'string' ? name.trim() : ''
  const d = typeof description === 'string' ? description.trim() : ''
  if (!n) {
    return res.status(400).json({ error: 'name is required' })
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    name: n,
    description: d,
    timestamp: new Date().toISOString(),
  }
  if (typeof image_url === 'string' && image_url.trim()) {
    payload.image_url = image_url.trim()
  }

  const { data, error } = await supabase
    .from('safe_places')
    .insert(payload)
    .select('id, user_id, name, description, timestamp, image_url')
    .single()

  if (error) {
    console.error('[safe-places] insert error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json({ place: data })
})

export default router
