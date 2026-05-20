import { Router, Request, Response } from 'express'
import { runCompanionChat, runWelcomeMessage, type CompanionChatRequest } from '../lib/chatRag.js'

const router = Router()

type HistoryItem = { role: string; content: string }

router.get('/welcome', async (_req: Request, res: Response) => {
  try {
    const welcome = await runWelcomeMessage()
    return res.status(200).json({ welcome })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Welcome unavailable'
    console.error('[chat/welcome]', e)
    if (/Missing OPENAI_API_KEY/i.test(msg)) {
      return res.status(503).json({ error: msg })
    }
    if (/Knowledge index unavailable/i.test(msg)) {
      return res.status(503).json({ error: msg })
    }
    return res.status(500).json({ error: msg })
  }
})

router.post('/', async (req: Request, res: Response) => {
  const body = req.body as Partial<CompanionChatRequest> & { message?: unknown; history?: unknown }
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

  const sessionRaw = body.sessionContext
  const validRoles = new Set(['user', 'assistant'])
  const historyClean = Array.isArray(body.history)
    ? (body.history as HistoryItem[])
        .filter((h) => validRoles.has(h.role) && typeof h.content === 'string')
        .map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        }))
    : []

  const inviteExerciseName =
    typeof body.inviteExerciseName === 'string' ? body.inviteExerciseName.trim() || null : undefined

  const companionReq: CompanionChatRequest = {
    message,
    history: historyClean,
    conversationStage: body.conversationStage ?? 'open',
    selectedEmotion: body.selectedEmotion ?? null,
    selectedUnderneath: body.selectedUnderneath ?? null,
    ...(inviteExerciseName !== undefined ? { inviteExerciseName } : {}),
    sessionContext: {
      caregiverName:
        typeof sessionRaw?.caregiverName === 'string' ? sessionRaw.caregiverName.trim() : '',
      caregiverRole:
        typeof sessionRaw?.caregiverRole === 'string' ? sessionRaw.caregiverRole.trim() : '',
            emotionCheckIn:
              typeof sessionRaw?.emotionCheckIn === 'string' && sessionRaw.emotionCheckIn.trim()
                ? sessionRaw.emotionCheckIn.trim()
                : null,
            lastActivity:
              typeof sessionRaw?.lastActivity === 'string' && sessionRaw.lastActivity.trim()
                ? sessionRaw.lastActivity.trim()
                : null,
    },
  }

  try {
    const result = await runCompanionChat(companionReq)
    return res.status(200).json({
      answer: result.answer,
      nextStage: result.nextStage,
      emotionChips: result.emotionChips,
      exercise: result.exercise,
      toolCards: result.toolCards,
      uiRedirect: result.uiRedirect,
      crisis: result.crisis,
      detectedEmotion: result.detectedEmotion,
      classifierIntent: result.classifierIntent,
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
