import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchSafePlaces, insertSafePlace, type SafePlaceRow } from '../../lib/safePlaces'
import {
  CARDEA_DARK_GREEN,
  CARDEA_LIGHT_BLUE,
  CARDEA_MUTED,
  CARDEA_NAVY,
} from '../../ui/cardeaTokens'

type ScriptStep = { text: string; seconds: number }
type ScriptSource = 'generic' | string

function buildScriptSteps(place: SafePlaceRow | null): ScriptStep[] {
  const name = place?.name?.trim()
  const desc = place?.description?.trim()
  return [
    { text: 'Settle in. Unclench your jaw. You are safe in this moment.', seconds: 15 },
    {
      text: name
        ? `Bring to mind ${name}. Let it feel real.`
        : 'Bring to mind a place where your body feels at ease.',
      seconds: 15,
    },
    {
      text: desc || 'Notice the light, the sounds, and the air around you.',
      seconds: 20,
    },
    { text: 'Let your shoulders drop. Feel your feet supported.', seconds: 15 },
    { text: 'Take three slow breaths here.', seconds: 15 },
    { text: 'When you are ready, gently return to the room.', seconds: 10 },
  ]
}

export function SafePlaceTool() {
  const [places, setPlaces] = useState<SafePlaceRow[]>([])
  const [scriptSource, setScriptSource] = useState<ScriptSource>('generic')
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<'script' | 'form'>('script')
  const [stepIdx, setStepIdx] = useState(0)
  const [running, setRunning] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)

  const activePlace = useMemo(() => {
    if (scriptSource === 'generic') return null
    return places.find((p) => p.id === scriptSource) ?? null
  }, [scriptSource, places])

  const steps = useMemo(() => buildScriptSteps(activePlace), [activePlace])
  const totalSeconds = useMemo(() => steps.reduce((a, s) => a + s.seconds, 0), [steps])
  const currentStep = steps[stepIdx]
  const elapsedBefore = useMemo(
    () => steps.slice(0, stepIdx).reduce((a, s) => a + s.seconds, 0),
    [steps, stepIdx],
  )
  const progress = totalSeconds > 0 ? (elapsedBefore / totalSeconds) * 100 : 0

  const reload = useCallback(async () => {
    setLoading(true)
    const rows = await fetchSafePlaces(20)
    setPlaces(rows)
    setScriptSource((prev) => {
      if (prev !== 'generic' && rows.some((p) => p.id === prev)) return prev
      return rows[0]?.id ?? 'generic'
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!running || panel !== 'script' || !currentStep) return
    const id = window.setTimeout(() => {
      if (stepIdx < steps.length - 1) {
        setStepIdx((i) => i + 1)
      } else {
        setRunning(false)
      }
    }, currentStep.seconds * 1000)
    return () => window.clearTimeout(id)
  }, [running, panel, stepIdx, currentStep, steps.length])

  function restartScript() {
    setStepIdx(0)
    setRunning(true)
    setPanel('script')
  }

  function selectScriptSource(source: ScriptSource) {
    setScriptSource(source)
    setStepIdx(0)
    setRunning(false)
  }

  function openWriteForm() {
    setName('')
    setDescription('')
    setSaveError(null)
    setSavedMsg(false)
    setPanel('form')
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSavedMsg(false)
    const { row, error } = await insertSafePlace(name, description)
    setSaving(false)
    if (error || !row) {
      setSaveError(error ?? 'Could not save.')
      return
    }
    setPlaces((prev) => [row, ...prev])
    setScriptSource(row.id)
    setSavedMsg(true)
    restartScript()
  }

  if (loading) {
    return (
      <p className="text-sm" style={{ color: CARDEA_MUTED }}>
        Loading your safe places…
      </p>
    )
  }

  const scriptLabel =
    scriptSource === 'generic'
      ? 'Default guide'
      : activePlace?.name ?? 'Saved place'

  return (
    <div className="space-y-5">
      {panel === 'script' ? (
        <>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: CARDEA_LIGHT_BLUE }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${running ? progress : 100}%`, background: CARDEA_DARK_GREEN }}
            />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_MUTED }}>
            {running ? `Step ${stepIdx + 1} of ${steps.length}` : 'Complete'} · ~90 seconds · {scriptLabel}
          </p>
          <div className="rounded-2xl bg-[#f5f9f9] p-6 text-center">
            <p className="text-lg leading-relaxed text-[#192b3f]">
              {running ? currentStep?.text : 'You finished the visualization.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!running ? (
              <button
                type="button"
                onClick={restartScript}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: CARDEA_NAVY }}
              >
                Run again
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRunning(false)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: CARDEA_NAVY, color: CARDEA_NAVY }}
              >
                Pause
              </button>
            )}

            <button
              type="button"
              onClick={openWriteForm}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: CARDEA_DARK_GREEN, color: CARDEA_DARK_GREEN }}
            >
              Write your own
            </button>

            {places.length > 0 ? (
              <label className="flex min-w-[10rem] flex-1 items-center gap-2 sm:flex-none">
                <span className="sr-only">Switch safe place</span>
                <select
                  value={scriptSource}
                  onChange={(e) => selectScriptSource(e.target.value as ScriptSource)}
                  className="w-full min-w-[10rem] rounded-xl border bg-white px-3 py-2 text-sm font-semibold outline-none sm:w-auto"
                  style={{ borderColor: CARDEA_LIGHT_BLUE, color: CARDEA_NAVY }}
                >
                  <option value="generic">Default guide</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </>
      ) : null}

      {panel === 'form' ? (
        <div className="space-y-3 rounded-2xl border bg-white p-4" style={{ borderColor: CARDEA_LIGHT_BLUE }}>
          <p className="text-sm font-semibold text-[#192b3f]">Write your own safe place</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. the lake cabin)"
            className="w-full rounded-xl border bg-[#f5f9f9] px-3 py-2 text-sm outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description — what you see, hear, and feel there"
            rows={4}
            className="w-full resize-y rounded-xl border bg-[#f5f9f9] px-3 py-2 text-sm outline-none"
          />
          {saveError ? <p className="text-sm text-[#9B1C31]">{saveError}</p> : null}
          {savedMsg ? (
            <p className="text-sm font-semibold" style={{ color: CARDEA_DARK_GREEN }}>
              Saved. Starting your personalized script…
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void handleSave()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: CARDEA_DARK_GREEN }}
            >
              {saving ? 'Saving…' : 'Save safe place'}
            </button>
            <button
              type="button"
              onClick={() => setPanel('script')}
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ color: CARDEA_MUTED }}
            >
              Back to script
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
