'use client'

import { motion } from 'framer-motion'

export default function LoadingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm">
        🤍
      </div>

      <div className="flex items-center gap-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            initial={{ y: 0 }}
            animate={{ y: -4 }}
            transition={{
              repeat: Infinity,
              repeatType: 'reverse',
              duration: 0.45,
              delay: i * 0.15,
            }}
            className="block w-1.5 h-1.5 rounded-full bg-slate-400"
          />
        ))}
      </div>
    </motion.div>
  )
}
