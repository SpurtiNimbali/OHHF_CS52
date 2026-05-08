'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Message } from '@/lib/mock-data'
import MessageBubble from './MessageBubble'
import LoadingBubble from './LoadingBubble'
import WelcomeState from './WelcomeState'

interface ChatThreadProps {
  messages: Message[]
  isLoading: boolean
}

export default function ChatThread({ messages, isLoading }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0 && !isLoading) {
    return <WelcomeState />
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4 px-4 py-6 max-w-2xl mx-auto">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && <LoadingBubble key="loading" />}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
