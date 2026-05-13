import { Router, Request, Response } from 'express'
import { runKbChat } from '../lib/chatRag.js'

const router = Router()

type HistoryItem = { role: string; content: string }

router.post('/', async (req: Request, res: Response) => {
  const body = req.body as { message?: unknown; history?: unknown }
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!message) {
    return res.status(400).json({ error: 'message is required (non-empty string)' })
  }

  if (body.history !== undefined) {
    if (!Array.isArray(body.history)) {
      return res.status(400).json({ error: 'history must be an array when provided' })
    }
    const bad = body.history.some(
      (h) =>
        !h ||
        typeof h !== 'object' ||
        typeof (h as HistoryItem).role !== 'string' ||
        typeof (h as HistoryItem).content !== 'string',
    )
    if (bad) {
      return res.status(400).json({ error: 'history items must be { role, content } strings' })
    }
  }

  try {
    const result = await runKbChat(message)
    return res.status(200).json({
      answer: result.answer,
      citations: result.citations,
      suggestedQuestions: result.suggestedQuestions,
      uiRedirects: result.uiRedirects,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Chat failed'
    console.error('[chat]', e)
    if (/Missing (ANTHROPIC_API_KEY|OPENAI_API_KEY)/i.test(msg)) {
      return res.status(503).json({ error: msg })
    }
    if (/Knowledge index unavailable/i.test(msg)) {
      return res.status(503).json({ error: msg })
    }
    return res.status(500).json({ error: msg })
  }
})

export default router
