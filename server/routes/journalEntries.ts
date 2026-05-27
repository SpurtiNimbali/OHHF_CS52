import { Router, type Request, type Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getUserIdFromRequest } from '../lib/authFromRequest.js'

const router = Router()

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
}

router.get('/', async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Sign in required' })
  }

  const limit = Math.min(Number(req.query.limit) || 50, 100)

  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, user_id, prompt, entry, timestamp, prompt_id, tags')
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

  const { prompt, entry, prompt_id, tags } = req.body as {
    prompt?: string
    entry?: string
    prompt_id?: number | null
    tags?: unknown
  }
  const trimmedEntry = typeof entry === 'string' ? entry.trim() : ''
  if (!trimmedEntry) {
    return res.status(400).json({ error: 'entry is required' })
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    prompt: typeof prompt === 'string' ? prompt.trim() : '',
    entry: trimmedEntry,
    timestamp: new Date().toISOString(),
    tags: normalizeTags(tags),
  }
  if (typeof prompt_id === 'number') payload.prompt_id = prompt_id

  const { data, error } = await supabase
    .from('journal_entries')
    .insert(payload)
    .select('id, user_id, prompt, entry, timestamp, prompt_id, tags')
    .single()

  if (error) {
    console.error('[journal-entries] insert error:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json({ entry: data })
})

export default router
