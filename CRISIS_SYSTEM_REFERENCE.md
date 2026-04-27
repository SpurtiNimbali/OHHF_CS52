/**
 * QUICK REFERENCE
 * 
 * Crisis Detection System for OHHF
 * ================================
 */

// 1. CRISIS KEYWORDS LIST
// File: src/lib/crisisKeywords.ts
// Contains:
// - CRISIS_KEYWORDS: Array of crisis-related phrases
// - CRISIS_REGEX: Regular expression for fast matching
// - detectCrisisKeywords(): Function to check text
// - CRISIS_RESOURCES: Array of crisis hotlines and resources
// Usage: import { detectCrisisKeywords, CRISIS_RESOURCES } from '../lib/crisisKeywords'

// 2. SERVER-SIDE CRISIS CHECK API
// File: api/crisis-check.ts
// Endpoint: POST /api/crisis-check
// What it does:
//   - Receives a message
//   - Checks for crisis keywords
//   - If detected, flags in database automatically
//   - Returns { isCrisis: boolean, flagged: boolean }
// Usage: Call from client-side components

// 3. CRISIS CARD COMPONENT
// File: src/components/CrisisCard.tsx
// Props:
//   - showIcon?: boolean (default: true)
//   - compact?: boolean (default: false)
// What it shows:
//   - "You're not alone" message
//   - All crisis hotlines with phone numbers
//   - Note that message is flagged for staff review

// 4. CLIENT-SIDE HELPERS
// File: src/lib/crisisDetectionClient.ts
// Functions:
//   - checkForCrisis(): Call API to check text
//   - processMessageWithCrisisCheck(): Check before sending to AI
// Usage: 
//   const result = await processMessageWithCrisisCheck(userMessage, userId, conversationId)
//   if (result.isCrisis) {
//     // Show CrisisCard instead of calling AI
//   }

// 5. DATABASE SCHEMA
// File: src/lib/databaseSchema.ts
// Sets up flagged_messages table with:
//   - message_text: The user's message
//   - flagged: true when crisis keywords detected
//   - reason: 'crisis_keywords_detected'
//   - reviewed: false until staff reviews
//   - staff_notes: For staff follow-up notes
// Setup: Copy SQL to Supabase → SQL Editor and execute

// TYPICAL FLOW IN CHAT
// =====================
// 1. User types message
// 2. Check with: await processMessageWithCrisisCheck(message)
// 3. If isCrisis = true:
//    → Show <CrisisCard /> component
//    → Message is flagged in database
//    → Skip AI call
// 4. If isCrisis = false:
//    → Continue normal flow
//    → Call your AI endpoint
//    → Display AI response

// SETUP CHECKLIST
// ================
// ☐ Copy database schema from src/lib/databaseSchema.ts
// ☐ Paste into Supabase SQL Editor and execute
// ☐ Add SUPABASE_SERVICE_ROLE_KEY to .env (needed for crisis-check API)
// ☐ Import CrisisCard in your chat component
// ☐ Call processMessageWithCrisisCheck() before AI call
// ☐ Show CrisisCard if crisis detected
// ☐ Create staff review dashboard to check flagged_messages table

export const VERSION = '1.0.0'
