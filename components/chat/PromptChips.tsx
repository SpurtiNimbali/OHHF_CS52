'use client'

import { motion } from 'framer-motion'
import { PromptChip } from '@/lib/mock-data'

interface PromptChipsProps {
  chips: PromptChip[]
  onChipClick: (label: string) => void
}

export default function PromptChips({ chips, onChipClick }: PromptChipsProps) {
  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none bg-slate-100 border-b border-slate-200">
      {chips.map((chip, i) => (
        <motion.button
          key={chip.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.25 }}
          onClick={() => onChipClick(chip.label)}
          className="flex-shrink-0 px-4 py-2 rounded-full bg-white border border-slate-200
                     text-sm text-slate-700 font-medium
                     hover:border-slate-400 hover:shadow-sm
                     active:scale-95 transition-all duration-150 cursor-pointer"
        >
          {chip.label}
        </motion.button>
      ))}
    </div>
  )
}
