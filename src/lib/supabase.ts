import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type CardiologistQuestion = {
  id: string
  question_text: string
  category: string
}

export type SavedQuestion = {
  id: string
  user_id: string
  question_id: string | null
  custom_text: string | null
}

export type SupportResource = {
  id: string
  name: string
  description: string
  category: 'Mental Health' | 'Family Support' | 'Financial Aid' | 'Community'
  link: string
  zipcode: string | null
  city: string | null
}
