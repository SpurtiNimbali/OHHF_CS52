/**
 * Database schema for crisis flagged messages
 * Run this SQL in Supabase to set up the flagged_messages table
 * 
 * Go to: Project Settings → SQL Editor → New Query
 * Copy and paste this SQL, then click Execute
 */

/*
-- Create flagged_messages table for OHHF crisis detection
CREATE TABLE IF NOT EXISTS flagged_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  conversation_id TEXT,
  message_text TEXT NOT NULL,
  flagged BOOLEAN DEFAULT true,
  reason TEXT NOT NULL,
  flagged_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reviewed BOOLEAN DEFAULT false,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  staff_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_flagged_messages_reviewed 
ON flagged_messages (reviewed, flagged_at DESC);

CREATE INDEX IF NOT EXISTS idx_flagged_messages_user_id 
ON flagged_messages (user_id, flagged_at DESC);

CREATE INDEX IF NOT EXISTS idx_flagged_messages_conversation_id 
ON flagged_messages (conversation_id, flagged_at DESC);

-- Enable RLS (Row Level Security) if needed
ALTER TABLE flagged_messages ENABLE ROW LEVEL SECURITY;

-- Policy for staff to view all flagged messages
CREATE POLICY "Staff can view flagged messages" 
ON flagged_messages FOR SELECT
USING (auth.jwt() ->> 'role' = 'staff' OR auth.jwt() ->> 'role' = 'admin');

-- Policy for service role (API) to insert flagged messages
-- Service role key bypasses RLS, so this policy is not strictly necessary
-- but you can add more granular policies as needed

*/

export const FLAGGED_MESSAGES_SCHEMA = `
CREATE TABLE IF NOT EXISTS flagged_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  conversation_id TEXT,
  message_text TEXT NOT NULL,
  flagged BOOLEAN DEFAULT true,
  reason TEXT NOT NULL,
  flagged_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reviewed BOOLEAN DEFAULT false,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  staff_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flagged_messages_reviewed 
ON flagged_messages (reviewed, flagged_at DESC);

CREATE INDEX IF NOT EXISTS idx_flagged_messages_user_id 
ON flagged_messages (user_id, flagged_at DESC);

CREATE INDEX IF NOT EXISTS idx_flagged_messages_conversation_id 
ON flagged_messages (conversation_id, flagged_at DESC);
`

/**
 * To review flagged messages in Supabase:
 * 
 * 1. Go to Table Editor
 * 2. Look for "flagged_messages" table
 * 3. Filter by reviewed = false to see unreviewed crisis messages4 * 4. Staff can click on messages and add notes, then mark as reviewed
 * 
 * Fields:
 * - id: Unique identifier
 * - user_id: User who sent the message (optional)
 * - conversation_id: Conversation ID (optional)
 * - message_text: The actual message content
 * - flagged: Boolean indicating if it's flagged (always true on creation)
 * - reason: Why it was flagged (e.g., 'crisis_keywords_detected')
 * - flagged_at: When the message was flagged
 * - reviewed: Whether staff has reviewed it
 * - reviewed_by: User ID of staff member who reviewed
 * - reviewed_at: When staff reviewed it
 * - staff_notes: Notes from staff review
 */
