import { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import {
  fetchMyReframes,
  fetchStarterReframes,
  insertUserReframe,
  type UserReframeRow,
} from '../../lib/userReframes'
import {
  CARDEA_DARK_GREEN,
  CARDEA_LIGHT_BLUE,
  CARDEA_MUTED,
  CARDEA_NAVY,
} from '../../ui/cardeaTokens'

const FALLBACK_STARTERS: UserReframeRow[] = [
  { id: 's1', user_id: null, thought: 'I have to handle everything', reframe: 'I can take one next step', timestamp: '' },
  { id: 's2', user_id: null, thought: "I can't fall apart", reframe: 'I can feel this and keep going', timestamp: '' },
  { id: 's3', user_id: null, thought: "I'm failing", reframe: "This is hard, and I'm trying", timestamp: '' },
  { id: 's4', user_id: null, thought: 'I should be stronger', reframe: 'strength includes asking for help', timestamp: '' },
  { id: 's5', user_id: null, thought: "I'm so behind", reframe: 'I am doing what I can', timestamp: '' },
  { id: 's6', user_id: null, thought: "I can't do this", reframe: 'I have done hard things today', timestamp: '' },
]

type View = 'browse' | 'write' | 'mine'

function ReframeCard({ thought, reframe }: { thought: string; reframe: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="rounded-2xl bg-[#f5f9f9] p-4">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_MUTED }}>
          The thought
        </p>
        <p className="text-lg text-[#3A525A] line-through">{thought}</p>
      </div>
      <ArrowRight className="mx-auto hidden h-5 w-5 text-[#acb7a8] sm:block" aria-hidden />
      <div className="rounded-2xl bg-[#577568]/10 p-4">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_DARK_GREEN }}>
          Try instead
        </p>
        <p className="text-lg font-semibold text-[#192b3f]">{reframe}</p>
      </div>
    </div>
  )
}

export function ReframesTool() {
  const [view, setView] = useState<View>('browse')
  const [starters, setStarters] = useState<UserReframeRow[]>(FALLBACK_STARTERS)
  const [mine, setMine] = useState<UserReframeRow[]>([])
  const [browseCardIndex, setBrowseCardIndex] = useState(0)
  const [mineCardIndex, setMineCardIndex] = useState(0)
  const [thought, setThought] = useState('')
  const [reframe, setReframe] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const [starterRows, myRows] = await Promise.all([fetchStarterReframes(), fetchMyReframes(50)])
    setStarters(starterRows.length > 0 ? starterRows.slice(0, 6) : FALLBACK_STARTERS)
    setMine(myRows)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const browseDeck = starters
  const browseCurrent = browseDeck[browseCardIndex % Math.max(browseDeck.length, 1)]
  const mineDeck = mine
  const mineCurrent = mineDeck[mineCardIndex % Math.max(mineDeck.length, 1)]

  useEffect(() => {
    if (mine.length === 0) return
    setMineCardIndex((i) => (i >= mine.length ? mine.length - 1 : i))
  }, [mine.length])

  async function handleSaveCustom() {
    setSaving(true)
    setSaveError(null)
    setSaveOk(false)
    const { row, error } = await insertUserReframe(thought, reframe)
    setSaving(false)
    if (error || !row) {
      setSaveError(error ?? 'Could not save.')
      return
    }
    setThought('')
    setReframe('')
    setSaveOk(true)
    setMine((prev) => [row, ...prev])
    setMineCardIndex(0)
    window.setTimeout(() => {
      setSaveOk(false)
      setView('mine')
    }, 600)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['browse', 'Browse cards'],
            ['mine', 'My reframes'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: view === id ? CARDEA_NAVY : '#f5f9f9',
              color: view === id ? '#fff' : CARDEA_NAVY,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: CARDEA_MUTED }}>
          Loading reframes…
        </p>
      ) : null}

      {view === 'browse' && !loading ? (
        <>
          {browseCurrent ? (
            <ReframeCard thought={browseCurrent.thought} reframe={browseCurrent.reframe} />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBrowseCardIndex((i) => i + 1)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: CARDEA_NAVY }}
            >
              Next reframe
            </button>
            <button
              type="button"
              onClick={() => setView('write')}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: CARDEA_DARK_GREEN, color: CARDEA_DARK_GREEN }}
            >
              Write your own
            </button>
          </div>
        </>
      ) : null}

      {view === 'write' ? (
        <div className="space-y-3 rounded-2xl border bg-white p-4" style={{ borderColor: CARDEA_LIGHT_BLUE }}>
          <p className="text-sm font-semibold text-[#192b3f]">Write your own</p>
          <input
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            placeholder="The thought"
            className="w-full rounded-xl border bg-[#f5f9f9] px-3 py-2 text-sm outline-none"
          />
          <input
            value={reframe}
            onChange={(e) => setReframe(e.target.value)}
            placeholder="Try instead"
            className="w-full rounded-xl border bg-[#f5f9f9] px-3 py-2 text-sm outline-none"
          />
          {saveError ? (
            <p className="text-sm text-[#9B1C31]">{saveError}</p>
          ) : null}
          {saveOk ? (
            <p className="text-sm font-semibold" style={{ color: CARDEA_DARK_GREEN }}>
              Saved to your profile.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !thought.trim() || !reframe.trim()}
              onClick={() => void handleSaveCustom()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: CARDEA_DARK_GREEN }}
            >
              {saving ? 'Saving…' : 'Save reframe'}
            </button>
            <button
              type="button"
              onClick={() => setView('browse')}
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ color: CARDEA_MUTED }}
            >
              Back to cards
            </button>
          </div>
        </div>
      ) : null}

      {view === 'mine' && !loading ? (
        <>
          {mine.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
                No saved reframes yet. Use &ldquo;Write your own&rdquo; from Browse cards.
              </p>
              <button
                type="button"
                onClick={() => setView('write')}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: CARDEA_DARK_GREEN, color: CARDEA_DARK_GREEN }}
              >
                Write your own
              </button>
            </div>
          ) : (
            <>
              {mineCurrent ? (
                <ReframeCard thought={mineCurrent.thought} reframe={mineCurrent.reframe} />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMineCardIndex((i) => i + 1)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: CARDEA_NAVY }}
                >
                  Next reframe
                </button>
                <button
                  type="button"
                  onClick={() => setView('write')}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: CARDEA_DARK_GREEN, color: CARDEA_DARK_GREEN }}
                >
                  Write your own
                </button>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
