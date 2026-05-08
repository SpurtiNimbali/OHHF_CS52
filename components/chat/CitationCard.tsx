'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Phone, Dumbbell, Wrench } from 'lucide-react'
import { CitationResource } from '@/lib/mock-data'

const TYPE_CONFIG = {
  article:  { Icon: ExternalLink, bg: 'bg-blue-50',  text: 'text-blue-600',  border: 'border-blue-100'  },
  hotline:  { Icon: Phone,        bg: 'bg-red-50',   text: 'text-red-600',   border: 'border-red-100'   },
  exercise: { Icon: Dumbbell,     bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-100' },
  tool:     { Icon: Wrench,       bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
}

export default function CitationCard({ resource }: { resource: CitationResource }) {
  const { Icon, bg, text, border } = TYPE_CONFIG[resource.type]

  const inner = (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${border} ${bg}`}>
      <div className={`flex-shrink-0 p-1.5 rounded-lg bg-white/60 ${text}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${text} mb-0.5`}>{resource.title}</p>
        <p className="text-xs text-slate-600 leading-relaxed">{resource.description}</p>
      </div>
      {resource.url && <ExternalLink className="flex-shrink-0 w-3 h-3 text-slate-400 mt-0.5" />}
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      {resource.url ? (
        <a href={resource.url} target="_blank" rel="noopener noreferrer"
           className="block hover:brightness-95 transition-all no-underline">
          {inner}
        </a>
      ) : inner}
    </motion.div>
  )
}
