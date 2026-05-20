import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import '../env.js'

let client: SupabaseClient | undefined

/** Creates the anon Supabase client on first use (check-in routes) so chat/care-team can boot without these vars locally. */
export function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseKey)
  }
  return client
}
