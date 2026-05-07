'use client'

import { motion } from 'framer-motion'
import { Message } from '@/lib/mock-data'
import CitationCard from './CitationCard'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm mt-0.5">
          🤍
        </div>
      )}

      <div className={`flex flex-col gap-2 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-slate-800 text-white rounded-tr-sm'
              : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'
          }`}
        >
          {message.content}
        </div>

        {/* Timestamp */}
        <span className="text-[11px] text-slate-400 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            {message.citations.map((c) => (
              <CitationCard key={c.id} resource={c} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
