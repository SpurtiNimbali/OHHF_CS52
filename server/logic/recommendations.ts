// Static mood → self-care tools mapping — no AI, fully deterministic
const moodMap: Record<string, string[]> = {
  anxious:     ['breathing_exercise', 'grounding_technique'],
  sad:         ['journaling', 'talk_to_friend'],
  stressed:    ['meditation', 'short_walk'],
  tired:       ['nap', 'light_stretching'],
  overwhelmed: ['task_breakdown', 'deep_breathing'],
  angry:       ['short_walk', 'journaling'],
  lonely:      ['talk_to_friend', 'community_resources'],
  scared:      ['grounding_technique', 'breathing_exercise'],
  hopeful:     ['journaling', 'gratitude_practice'],
  numb:        ['light_stretching', 'sensory_grounding'],
}

/**
 * Maps an array of moods to a deduplicated list of recommended self-care tools.
 * Moods not found in the map are silently skipped.
 */
export function getRecommendations(moods: string[]): string[] {
  const toolSet = new Set<string>()

  for (const mood of moods) {
    const tools = moodMap[mood.toLowerCase().trim()]
    if (tools) {
      tools.forEach(t => toolSet.add(t))
    }
  }

  return Array.from(toolSet)
}
