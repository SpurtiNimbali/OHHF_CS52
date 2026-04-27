import { createClient } from '@supabase/supabase-js'
import { detectCrisisKeywords } from '../../src/lib/crisisKeywords'

type ApiRequest = {
  method?: string
  body?: string
  query?: Record<string, string | string[]>
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => {
    json: (body: unknown) => void
  }
}

interface MessagePayload {
  text: string
  userId?: string
  conversationId?: string
}

interface CrisisDetectionResponse {
  isCrisis: boolean
  flagged: boolean
  message?: string
  crisisDetected?: boolean
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({
      error: 'Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    })
  }

  try {
    // Parse request body
    const messagePayload: MessagePayload = JSON.parse(req.body || '{}')

    if (!messagePayload.text) {
      return res.status(400).json({ error: 'Missing message text' })
    }

    // Check for crisis keywords
    const crisisDetected = detectCrisisKeywords(messagePayload.text)

    const response: CrisisDetectionResponse = {
      isCrisis: crisisDetected,
      flagged: false,
      crisisDetected
    }

    // If crisis detected, flag in database
    if (crisisDetected) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Insert a flagged message record for staff review
      const { error: dbError } = await supabase.from('flagged_messages').insert({
        user_id: messagePayload.userId || null,
        conversation_id: messagePayload.conversationId || null,
        message_text: messagePayload.text,
        flagged: true,
        reason: 'crisis_keywords_detected',
        flagged_at: new Date().toISOString(),
        reviewed: false
      })

      if (dbError) {
        console.error('Error flagging message:', dbError)
        // Still return crisis detected, even if DB write fails
        response.message = 'Crisis detected and flagged for review'
      } else {
        response.flagged = true
        response.message = 'Crisis detected and flagged for review'
      }
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('Error processing crisis detection:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
