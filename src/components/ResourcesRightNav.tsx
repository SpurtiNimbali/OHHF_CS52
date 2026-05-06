import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Home, Activity, MessageCircle, Heart } from 'lucide-react'
import { moodColorWithAlpha, useMood } from '../mood'

const FONT_UI = "'Montserrat', Inter, system-ui, sans-serif"

/** Three reference tiles: coral (heart), mint (pulse), periwinkle (chat) */
export const NAV_TILE_PALETTE = {
  coral: {
    tile: '#FFAAA5',
    icon: '#8B3A36',
    label: '#8B3A36',
    hoverTile: 'hover:bg-[#FFAAA5]/45',
    labelHover: 'hover:text-[#8B3A36]',
  },
  mint: {
    tile: '#A8E6CF',
    icon: '#2d5f4f',
    label: '#2d5f4f',
    hoverTile: 'hover:bg-[#A8E6CF]/45',
    labelHover: 'hover:text-[#2d5f4f]',
  },
  sky: {
    tile: '#A8C5E6',
    icon: '#192b3f',
    label: '#2d4f6f',
    hoverTile: 'hover:bg-[#A8C5E6]/45',
    labelHover: 'hover:text-[#2d4f6f]',
  },
} as const

type TabId = 'home' | 'track' | 'learn' | 'support'

type PaletteKey = keyof typeof NAV_TILE_PALETTE

const items: {
  id: TabId
  label: string
  to: string
  Icon: typeof Home
  palette: PaletteKey
}[] = [
  { id: 'home', label: 'Home', to: '/home', Icon: Home, palette: 'mint' },
  { id: 'track', label: 'Track', to: '/home', Icon: Activity, palette: 'mint' },
  { id: 'learn', label: 'Learn', to: '/resources', Icon: MessageCircle, palette: 'sky' },
  { id: 'support', label: 'Support', to: '/resources?view=support', Icon: Heart, palette: 'coral' },
]

export function ResourcesRightNav() {
  const { theme } = useMood()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const view = searchParams.get('view')

  const activeTab: TabId =
    location.pathname === '/resources'
      ? view === 'support'
        ? 'support'
        : 'learn'
      : 'home'

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 }}
      className="flex w-20 shrink-0 flex-col items-center border-l py-8 shadow-lg backdrop-blur-md transition-all duration-700 bg-white/88"
      style={{
        fontFamily: FONT_UI,
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
