import { motion } from 'motion/react'

import { CARDEA_FONT_PRIMARY } from '../../ui/cardeaTokens'

type HomeMoodChipButtonProps = {
  label: string
  selected: boolean
  onClick: () => void
  activeClassNames: string
  index: number
}

/** Mood picker chip on Home. */
export function HomeMoodChipButton({
  label,
  selected,
  onClick,
  activeClassNames,
  index,
}: HomeMoodChipButtonProps) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.15 + index * 0.05 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm transition-all border ${
        selected ? `${activeClassNames} shadow-md border-transparent` : 'bg-white text-[#3A525A] border-gray-200'
      }`}
      style={{ fontFamily: CARDEA_FONT_PRIMARY }}
    >
      {label}
    </motion.button>
  )
}
