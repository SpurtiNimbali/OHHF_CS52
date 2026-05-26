import { isSupabaseConfigured, supabase } from './supabase'
import type { Nudge } from './supabase'

const FALLBACK_NUDGES: Nudge[] = [
  { id: 1, nudge_text: 'Take 3 deep breaths before checking your phone.' },
  { id: 2, nudge_text: 'Drink a glass of water and stretch for 1 minute.' },
  { id: 3, nudge_text: 'Text someone you appreciate today.' },
  { id: 4, nudge_text: 'Step outside for fresh air, even if only for 2 minutes.' },
  { id: 5, nudge_text: 'Write down one thing that went well today.' },
  { id: 6, nudge_text: 'Unclench your jaw and relax your shoulders.' },
  { id: 7, nudge_text: 'Listen to one song without multitasking.' },
  { id: 8, nudge_text: 'Take a short walk without your phone.' },
  { id: 9, nudge_text: 'Tell yourself one thing you are proud of.' },
  { id: 10, nudge_text: 'Do one small task you’ve been avoiding.' },
  { id: 11, nudge_text: 'Pause and notice 5 things you can see around you.' },
  { id: 12, nudge_text: 'Smile at someone today, even briefly.' },
  { id: 13, nudge_text: 'Spend 5 minutes away from screens.' },
  { id: 14, nudge_text: 'Check in with how your body feels right now.' },
  { id: 15, nudge_text: 'Give yourself permission to rest for a moment.' },
  { id: 16, nudge_text: 'Send a kind message to a friend.' },
  { id: 17, nudge_text: 'Take a deep breath before responding to stress.' },
  { id: 18, nudge_text: 'Celebrate one small win from today.' },
  { id: 19, nudge_text: 'Put on a song that makes you feel calm.' },
  { id: 20, nudge_text: 'Remind yourself that progress can be small.' },
]

export async function fetchNudges(): Promise<Nudge[]> {
  if (!isSupabaseConfigured) return FALLBACK_NUDGES
  const { data, error } = await supabase
    .from('nudges')
    .select('id, nudge_text')
    .order('id')
  if (error || !data || data.length === 0) return FALLBACK_NUDGES
  return data as Nudge[]
}
