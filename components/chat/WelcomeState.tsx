'use client'

import { motion } from 'framer-motion'
import { MessageCircle, Heart, Shield } from 'lucide-react'
import { FEATURE_CARDS, FeatureIconKey } from '@/lib/mock-data'

const ICONS: Record<FeatureIconKey, React.ComponentType<{ className?: string }>> = {
  message: MessageCircle,
  heart: Heart,
  shield: Shield,
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

export default function WelcomeState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center flex-1 px-6 py-10 text-center"
    >
      {/* Heart icon pill */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-center w-20 h-14 rounded-[2rem] bg-slate-200/70 mb-6"
      >
        <Heart className="w-7 h-7 text-slate-500" strokeWidth={1.5} />
      </motion.div>

      {/* Heading */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="text-xl font-semibold text-slate-800 mb-3"
      >
        Welcome to Mental Health Support
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="text-sm text-slate-500 max-w-sm leading-relaxed mb-8"
      >
        I&apos;m here to listen and provide supportive resources. Your wellbeing
        matters, and you&apos;re not alone in this journey.
      </motion.p>

      {/* Feature cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-3 gap-3 w-full max-w-xl mb-8"
      >
        {FEATURE_CARDS.map((card) => {
          const Icon = ICONS[card.icon]
          return (
            <motion.div
              key={card.id}
              variants={item}
              className="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm"
            >
              <Icon className="w-6 h-6 text-slate-300" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-slate-800">{card.title}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{card.description}</p>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Crisis support */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="text-xs text-slate-500 max-w-sm leading-relaxed"
      >
        <span className="font-semibold text-slate-700">Crisis Support:</span> If
        you&apos;re in crisis, please contact{' '}
        <span className="font-medium">988 Suicide &amp; Crisis Lifeline</span> (call
        or text 988) or emergency services (911).
      </motion.p>
    </motion.div>
  )
}
