import { Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { BookOpen, Home, MessageCircle, Wind } from 'lucide-react'
import { moodColorWithAlpha, useMood } from '../mood'
import { CARDEA_FONT_MONTSERRAT_STACK } from '../ui/cardeaTokens'

/** Nav tiles ~53–57% saturation; icons/labels ~38–40% — keeps Home / Resources / Tools / Chat visually even */
export const NAV_TILE_PALETTE = {
  coral: {
    tile: '#E8B4B0',
    icon: '#6B4540',
    label: '#6B4540',
    hoverTile: 'hover:bg-[#E8B4B0]/45',
    labelHover: 'hover:text-[#6B4540]',
  },
  mint: {
    tile: '#A8E6CF',
    icon: '#2f6a57',
    label: '#2f6a57',
    hoverTile: 'hover:bg-[#A8E6CF]/45',
    labelHover: 'hover:text-[#2f6a57]',
  },
  sky: {
    tile: '#A8C5E6',
    icon: '#2e556b',
    label: '#2e556b',
    hoverTile: 'hover:bg-[#A8C5E6]/45',
    labelHover: 'hover:text-[#2e556b]',
  },
  lavender: {
    tile: '#C4B5E8',
    icon: '#453371',
    label: '#453371',
    hoverTile: 'hover:bg-[#C4B5E8]/45',
    labelHover: 'hover:text-[#453371]',
  },
  wellness: {
    tile: '#C4B5E8',
    icon: '#453371',
    label: '#453371',
    hoverTile: 'hover:bg-[#C4B5E8]/45',
    labelHover: 'hover:text-[#453371]',
  },
  chat: {
    tile: '#A5C0E6',
    icon: '#2e4e6b',
    label: '#2e4e6b',
    hoverTile: 'hover:bg-[#A5C0E6]/45',
    labelHover: 'hover:text-[#2e4e6b]',
  },
} as const

type TabId = 'home' | 'resources' | 'wellness' | 'chat'

type PaletteKey = keyof typeof NAV_TILE_PALETTE

const items: {
  id: TabId
  label: string
  to: string
  Icon: typeof Home
  palette: PaletteKey
}[] = [
  { id: 'home',    label: 'Home',    to: '/home',                   Icon: Home,          palette: 'mint'     },
  { id: 'resources', label: 'Resources', to: '/resources', Icon: BookOpen, palette: 'sky' },
  { id: 'wellness', label: 'Tools',   to: '/wellness',               Icon: Wind,          palette: 'wellness' },
  { id: 'chat',    label: 'Chat',    to: '/chat',                   Icon: MessageCircle, palette: 'chat' },
]

export function ResourcesRightNav() {
  const { theme } = useMood()
  const location = useLocation()

  const activeTab: TabId =
    location.pathname === '/chat' || location.pathname.startsWith('/chat/')
      ? 'chat'
      : location.pathname === '/wellness'
        ? 'wellness'
      : location.pathname === '/resources'
        ? 'resources'
        : 'home'

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 }}
      className="flex w-20 shrink-0 flex-col items-center border-l py-8 shadow-lg backdrop-blur-md transition-all duration-700 bg-white/88"
      style={{
        fontFamily: CARDEA_FONT_MONTSERRAT_STACK,
        borderLeftColor: moodColorWithAlpha(theme.heartFill, 0.28),
      }}
    >
      <nav aria-label="Section" className="flex flex-1 flex-col items-center gap-6">
        {items.map((item) => {
          const active = item.id === activeTab
          const P = NAV_TILE_PALETTE[item.palette]

          return (
            <motion.div key={item.id} whileHover={{ scale: 1.06 }} className="flex flex-col items-center">
              <Link
                to={item.to}
                className={`flex flex-col items-center gap-2 no-underline transition-colors ${
                  active ? 'cursor-pointer' : `text-gray-400 ${P.labelHover}`
                }`}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-colors duration-200 ${
                    active ? '' : `bg-[#f0f3f2] ${P.hoverTile}`
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: P.tile,
                          boxShadow: '0 2px 8px rgba(25, 43, 63, 0.08)',
                        }
                      : undefined
                  }
                >
                  <item.Icon
                    className="h-6 w-6"
                    strokeWidth={2}
                    style={{ color: active ? P.icon : undefined }}
                  />
                </div>
                <span
                  className={`text-xs ${active ? 'font-semibold' : ''}`}
                  style={{ color: active ? P.label : undefined }}
                >
                  {item.label}
                </span>
              </Link>
            </motion.div>
          )
        })}
      </nav>
      <button
        type="button"
        aria-label="Help"
        className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(25,43,63,0.12)] bg-white text-base font-semibold text-gray-400 hover:bg-[#f5f9f9]"
      >
        ?
      </button>
    </motion.aside>
  )
}
