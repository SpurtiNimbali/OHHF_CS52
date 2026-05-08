'use client'

import { useState, useRef, useCallback, KeyboardEvent, ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSend = value.trim().length > 0 && !disabled

  const handleSend = useCallback(() => {
    if (!canSend) return
    onSend(value.trim())
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [canSend, onSend, value])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="bg-white border-t border-slate-200 px-4 pt-3 pb-4">
      <div className="flex items-end gap-3 max-w-2xl mx-auto">
        {/* Textarea */}
        <div className="flex-1 flex items-end bg-white border border-slate-200 rounded-2xl px-4 py-3
                        focus-within:border-slate-400 transition-colors shadow-sm">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Share what's on your mind..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-slate-800
                       placeholder:text-slate-400 focus:outline-none leading-relaxed
                       max-h-40 disabled:opacity-50"
          />
        </div>

        {/* Send button */}
        <motion.button
          onClick={handleSend}
          disabled={!canSend}
          whileHover={canSend ? { scale: 1.06 } : {}}
          whileTap={canSend ? { scale: 0.94 } : {}}
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors
                      ${canSend
                        ? 'bg-slate-800 text-white hover:bg-slate-700 cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          aria-label="Send message"
        >
          <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
        </motion.button>
      </div>

      <p className="text-center text-[11px] text-slate-400 mt-2 select-none">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  )
}
