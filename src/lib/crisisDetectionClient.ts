import { detectCrisisKeywords } from './crisisKeywords'

export interface CrisisCheckRequest {
  text: string
  userId?: string
  conversationId?: string
}

export interface CrisisCheckResponse {
  isCrisis: boolean
  flagged: boolean
  message?: string
  crisisDetected?: boolean
}

/**
 * Check a message for crisis keywords (client-side only)
 * Since you don't have SUPABASE_SERVICE_ROLE_KEY, this version
 * detects crisis keywords but doesn't flag in database
 *
 * @param request - The request containing the message text to check
 * @returns Promise with crisis detection result
 */
export async function checkForCrisis(request: CrisisCheckRequest): Promise<CrisisCheckResponse> {
  try {
    // Client-side detection only
    const crisisDetected = detectCrisisKeywords(request.text)

    const response: CrisisCheckResponse = {
      isCrisis: crisisDetected,
      flagged: false, // Can't flag without service role key
      crisisDetected
    }

    if (crisisDetected) {
      response.message = 'Crisis detected - showing support resources'
    }

    return response
  } catch (error) {
    console.error('Error checking for crisis keywords:', error)
    // Return safe default
    return {
      isCrisis: false,
      flagged: false,
      message: 'Crisis check unavailable'
    }
  }
}

/**
 * Process a message through crisis detection before sending to AI
 * If crisis detected, returns info to show crisis card instead of calling AI
 * No database flagging since service role key not available
 *
 * @param message - The user message to process
 * @param userId - Optional user ID (not used without DB)
 * @param conversationId - Optional conversation ID (not used without DB)
 * @returns Crisis detection result
 */
export async function processMessageWithCrisisCheck(
  message: string,
  userId?: string,
  conversationId?: string
): Promise<{ isCrisis: boolean; message?: string }> {
  const result = await checkForCrisis({
    text: message,
    userId,
    conversationId
  })

  return {
    isCrisis: result.crisisDetected || result.isCrisis,
    message: result.message
  }
}

/**
 * Example usage in a chat component:
 * 
 * const handleSendMessage = async (userMessage: string) => {
 *   const crisisCheck = await processMessageWithCrisisCheck(userMessage, userId)
 *   
 *   if (crisisCheck.isCrisis) {
 *     // Show crisis card instead of calling AI
 *     setMessages(prev => [...prev, {
 *       type: 'crisis',
 *       content: crisisCheck.message
 *     }])
 *     return
 *   }
 *   
 *   // Otherwise proceed with normal AI call
 *   const aiResponse = await callAI(userMessage)
 *   setMessages(prev => [...prev, { type: 'ai', content: aiResponse }])
 * }
 */
