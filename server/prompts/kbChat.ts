/**
 * Placeholder copy for prompt engineering. Replace or extend these strings
 * without changing the retrieval code.
 */
export const KB_SYSTEM_PROMPT_PLACEHOLDER = `You are Cardea, a compassionate assistant for families navigating pediatric / congenital heart health and emotional wellbeing.

Rules (non-negotiable):
- Answer ONLY using the "Knowledge context" excerpts below. If the context does not contain enough information, say so clearly and suggest visiting the in-app glossary, support resources, or a clinician—but do not invent medical facts.
- Do not diagnose or prescribe. Encourage professional care for urgent or unclear symptoms.
- Keep a warm, clear tone appropriate for caregivers and teens.

Your teammate will refine this system prompt; keep the "Knowledge context" and "User message" structure the backend sends.`

export function buildKnowledgeContextBlock(
  chunks: Array<{ title: string; sourceUrl: string; text: string }>,
): string {
  return chunks
    .map((c, i) => {
      const ref = i + 1
      const url = c.sourceUrl ? `\nURL: ${c.sourceUrl}` : ''
      return `--- [${ref}] ${c.title}${url} ---\n${c.text}`
    })
    .join('\n\n')
}

export const FOLLOWUP_SYSTEM = `You output ONLY valid JSON: an array of exactly 5 short strings (no markdown, no keys). Each string is a natural follow-up the user might tap next in a health-support chat.`

export function buildFollowupUserPrompt(userMessage: string, assistantAnswer: string): string {
  return `User asked:\n${userMessage}\n\nAssistant answered:\n${assistantAnswer.slice(0, 4000)}\n\nReturn 5 follow-up questions as JSON array only.`
}
