'use client'

import { useState, useCallback } from 'react'
import { Message, MOCK_MESSAGES, PROMPT_CHIPS, MOCK_CITATIONS } from '@/lib/mock-data'
import ChatHeader from './ChatHeader'
import PromptChips from './PromptChips'
import ChatThread from './ChatThread'
import ChatInput from './ChatInput'

export default function ChatPageClient() {
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES)
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    // ── Replace this block with your real API call ─────────────────────────
    await new Promise((r) => setTimeout(r, 1400))

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        "Thank you for sharing that with me — it takes courage to reach out. I'm here with you. Would you like to try a quick breathing exercise together, or would it help to talk more about what you're experiencing?",
      timestamp: new Date(),
      citations: content.toLowerCase().includes('breath') ? MOCK_CITATIONS.slice(0, 1) : undefined,
    }
    // ── End of mock block ──────────────────────────────────────────────────

    setMessages((prev) => [...prev, assistantMsg])
    setIsLoading(false)
  }, [isLoading])

  const handleChipClick = useCallback(
    (label: string) => handleSend(label),
    [handleSend],
  )

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <ChatHeader />
      <PromptChips chips={PROMPT_CHIPS} onChipClick={handleChipClick} />
      <ChatThread messages={messages} isLoading={isLoading} />
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  )
}
