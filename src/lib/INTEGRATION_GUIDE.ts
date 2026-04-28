/**
 * Crisis Detection System Integration Guide
 * 
 * This guide shows how to integrate the crisis detection system into your chat/message handler
 */

/**
 * STEP-BY-STEP INTEGRATION
 * 
 * 1. DATABASE SETUP
 * ====================
 * - Go to Supabase dashboard
 * - SQL Editor → New Query
 * - Copy the schema from src/lib/databaseSchema.ts
 * - Execute the query
 * - Verify the flagged_messages table appears in Table Editor
 * 
 * 2. ENVIRONMENT VARIABLES
 * ====================
 * Make sure your .env includes:
 * - SUPABASE_URL
 * - SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)
 * - SUPABASE_SERVICE_ROLE_KEY (required for the crisis-check API endpoint)
 * 
 * 3. USE IN YOUR CHAT COMPONENT
 * ====================
 * 
 * Example implementation:
 * 
 * import { processMessageWithCrisisCheck } from '../lib/crisisDetectionClient'
 * import CrisisCard from '../components/CrisisCard'
 * 
 * function ChatComponent() {
 *   const [messages, setMessages] = useState([])
 *   
 *   const handleSendMessage = async (userMessage: string) => {
 *     // Check for crisis keywords
 *     const crisisCheck = await processMessageWithCrisisCheck(
 *       userMessage, 
 *       userId,        // optional: pass user ID if available
 *       conversationId // optional: pass conversation ID if available
 *     )
 *     
 *     if (crisisCheck.isCrisis) {
 *       // Skip AI call, show crisis card instead
 *       setMessages(prev => [...prev, {
 *         id: Date.now(),
 *         type: 'crisis',
 *         content: 'Crisis detected'
 *       }])
 *       return
 *     }
 *     
 *     // Normal flow: add user message and get AI response
 *     setMessages(prev => [...prev, {
 *       id: Date.now(),
 *       type: 'user',
 *       content: userMessage
 *     }])
 *     
 *     const aiResponse = await fetch('/api/your-ai-endpoint', {
 *       method: 'POST',
 *       body: JSON.stringify({ message: userMessage })
 *     })
 *     
 *     setMessages(prev => [...prev, {
 *       id: Date.now(),
 *       type: 'assistant',
 *       content: aiResponse
 *     }])
 *   }
 *   
 *   return (
 *     <div>
 *       {messages.map(msg => 
 *         msg.type === 'crisis' ? (
 *           <CrisisCard key={msg.id} compact={false} />
 *         ) : (
 *           <div key={msg.id} className={msg.type}>
 *             {msg.content}
 *           </div>
 *         )
 *       )}
 *     </div>
 *   )
 * }
 */

/**
 * STAFF REVIEW DASHBOARD
 * ====================
 * 
 * To display flagged messages for staff review:
 * 
 * import { useEffect, useState } from 'react'
 * import { createClient } from '@supabase/supabase-js'
 * 
 * function StaffReviewDashboard() {
 *   const [flaggedMessages, setFlaggedMessages] = useState([])
 *   
 *   useEffect(() => {
 *     const fetchFlaggedMessages = async () => {
 *       const supabase = createClient(
 *         process.env.REACT_APP_SUPABASE_URL,
 *         process.env.REACT_APP_SUPABASE_ANON_KEY
 *       )
 *       
 *       const { data } = await supabase
 *         .from('flagged_messages')
 *         .select('*')
 *         .eq('reviewed', false)
 *         .order('flagged_at', { ascending: false })
 *       
 *       setFlaggedMessages(data || [])
 *     }
 *     
 *     fetchFlaggedMessages()
 *   }, [])
 *   
 *   const markAsReviewed = async (id: number, notes: string) => {
 *     const supabase = createClient(...)
 *     
 *     await supabase
 *       .from('flagged_messages')
 *       .update({
 *         reviewed: true,
 *         reviewed_at: new Date().toISOString(),
 *         reviewed_by: currentUserId,
 *         staff_notes: notes
 *       })
 *       .eq('id', id)
 *   }
 *   
 *   return (
 *     <div>
 *       <h2>Crisis Messages Requiring Review</h2>
 *       {flaggedMessages.map(msg => (
 *         <div key={msg.id} style={{ border: '1px solid red', padding: '10px' }}>
 *           <p><strong>Message:</strong> {msg.message_text}</p>
 *           <p><strong>User:</strong> {msg.user_id}</p>
 *           <p><strong>Time:</strong> {new Date(msg.flagged_at).toLocaleString()}</p>
 *           <button onClick={() => markAsReviewed(msg.id, 'Reviewed and contacted user')}>
 *             Mark as Reviewed
 *           </button>
 *         </div>
 *       ))}
 *     </div>
 *   )
 * }
 */

/**
 * API ENDPOINTS
 * ====================
 * 
 * POST /api/crisis-check
 * Checks a message for crisis keywords
 * 
 * Request body:
 * {
 *   text: string                    (required)
 *   userId?: string                 (optional)
 *   conversationId?: string         (optional)
 * }
 * 
 * Response:
 * {
 *   isCrisis: boolean
 *   flagged: boolean
 *   message?: string
 *   crisisDetected?: boolean
 * }
 */

/**
 * KEYWORDS MONITORED
 * ====================
 * 
 * The system detects:
 * -Suicidal ideation (suicide, kill myself, take my life, etc.)
 * - Severe depression/hopelessness
 * - Self-harm indicators
 * - Abuse indicators
 * - Child safety concerns
 * 
 * See src/lib/crisisKeywords.ts for the complete list
 */

export const INTEGRATION_COMPLETE = true
