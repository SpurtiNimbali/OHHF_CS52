import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ImagePlus } from 'lucide-react'
import { fetchSafePlaces, insertSafePlace, type SafePlaceRow } from '../../lib/safePlaces'
import {
  loadGenericSafePlaceImage,
  saveGenericSafePlaceImage,
  uploadSafePlaceImage,
  validateSafePlaceImageFile,
} from '../../lib/safePlaceImages'
import {
  CARDEA_DARK_GREEN,
  CARDEA_LIGHT_BLUE,
  CARDEA_MUTED,
  CARDEA_NAVY,
} from '../../ui/cardeaTokens'
import {
  DEFAULT_SAFE_PLACE_SCENE,
  inferSafePlaceScene,
  loadPreferredScene,
  loadSceneForPlace,
  loadSceneMap,
  SAFE_PLACE_SCENES,
  SafePlaceSceneArt,
  savePreferredScene,
  saveSceneForPlace,
  safePlaceSceneMeta,
  type SafePlaceSceneId,
} from './safePlaceScenes'

type ScriptStep = { text: string; seconds: number }
type ScriptSource = 'generic' | string
type SafePlaceVisual =
  | { type: 'scene'; sceneId: SafePlaceSceneId }
  | { type: 'image'; url: string }

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

function resolveScene(
  scriptSource: ScriptSource,
  activePlace: SafePlaceRow | null,
  genericScene: SafePlaceSceneId,
  savedPlaceScenes: Record<string, SafePlaceSceneId>,
): SafePlaceSceneId {
  if (scriptSource === 'generic') return genericScene
  if (activePlace) {
    const stored = savedPlaceScenes[activePlace.id] ?? loadSceneForPlace(activePlace.id, savedPlaceScenes)
    if (stored) return stored
    return inferSafePlaceScene(activePlace.name, activePlace.description)
  }
  return genericScene
}

function resolveVisual(
  scriptSource: ScriptSource,
  activePlace: SafePlaceRow | null,
  genericScene: SafePlaceSceneId,
  savedPlaceScenes: Record<string, SafePlaceSceneId>,
  genericImageUrl: string | null,
  genericUsesPhoto: boolean,
  placeUsesPhoto: Record<string, boolean>,
): SafePlaceVisual {
  if (scriptSource === 'generic') {
    if (genericUsesPhoto && genericImageUrl) {
      return { type: 'image', url: genericImageUrl }
    }
    return { type: 'scene', sceneId: genericScene }
  }
  if (activePlace) {
    const prefersPhoto = placeUsesPhoto[activePlace.id] ?? Boolean(activePlace.image_url)
    if (prefersPhoto && activePlace.image_url) {
      return { type: 'image', url: activePlace.image_url }
    }
    return {
      type: 'scene',
      sceneId: resolveScene(scriptSource, activePlace, genericScene, savedPlaceScenes),
    }
  }
  return { type: 'scene', sceneId: genericScene }
}

function SafePlaceVisualArt({
  visual,
  animate = false,
  warmth = 0,
  className = '',
}: {
  visual: SafePlaceVisual
  animate?: boolean
  warmth?: number
  className?: string
}) {
  if (visual.type === 'image') {
    return (
      <img
        src={visual.url}
        alt=""
        className={`h-full w-full object-cover ${className}`.trim()}
      />
    )
  }
  return (
    <SafePlaceSceneArt
      sceneId={visual.sceneId}
      animate={animate}
      warmth={warmth}
      className={className}
    />
  )
}

function ScenePicker({
  value,
  onChange,
  onUploadClick,
  compact = false,
  showUpload = true,
  photoActive = false,
  photoPreviewUrl = null,
}: {
  value: SafePlaceSceneId
  onChange: (sceneId: SafePlaceSceneId) => void
  onUploadClick?: () => void
  compact?: boolean
  showUpload?: boolean
  photoActive?: boolean
  photoPreviewUrl?: string | null
}) {
  return (
    <div className={compact ? 'flex gap-2 overflow-x-auto pb-1' : 'grid grid-cols-2 gap-2 sm:grid-cols-3'}>
      {SAFE_PLACE_SCENES.map((scene) => {
        const selected = !photoActive && value === scene.id
        return (
          <button
            key={scene.id}
            type="button"
            onClick={() => onChange(scene.id)}
            className={`overflow-hidden rounded-2xl border text-left transition-all ${
              compact ? 'min-w-[7.5rem] shrink-0' : ''
            } ${selected ? 'ring-2 ring-[#577568]/45' : 'hover:border-[#577568]/35'}`}
            style={{ borderColor: selected ? CARDEA_DARK_GREEN : CARDEA_LIGHT_BLUE }}
          >
            <div className={`relative ${compact ? 'h-16' : 'h-24'} bg-[#eef4f6]`}>
              <SafePlaceSceneArt sceneId={scene.id} className="absolute inset-0" />
              {selected ? (
                <span
                  className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white"
                  style={{ background: CARDEA_DARK_GREEN }}
                >
                  Active
                </span>
              ) : null}
            </div>
            {!compact ? (
              <div className="space-y-0.5 bg-white px-3 py-2">
                <p className="text-xs font-semibold text-[#192b3f]">{scene.label}</p>
                <p className="text-[10px] leading-snug" style={{ color: CARDEA_MUTED }}>
                  {scene.tagline}
                </p>
              </div>
            ) : (
              <p className="truncate bg-white px-2 py-1.5 text-[10px] font-semibold text-[#192b3f]">
                {scene.label}
              </p>
            )}
          </button>
        )
      })}
      {showUpload && onUploadClick ? (
        <button
          type="button"
          onClick={onUploadClick}
          className={`overflow-hidden rounded-2xl border text-left transition-all ${
            compact ? 'min-w-[7.5rem] shrink-0' : ''
          } ${photoActive ? 'ring-2 ring-[#577568]/45' : 'border-dashed hover:border-[#577568]/45 hover:bg-[#f5f9f9]'}`}
          style={{ borderColor: photoActive ? CARDEA_DARK_GREEN : CARDEA_LIGHT_BLUE }}
        >
          <div className={`relative ${compact ? 'h-16' : 'h-24'} bg-[#eef4f6]`}>
            {photoPreviewUrl ? (
              <img src={photoPreviewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 px-2">
                <ImagePlus className="h-5 w-5" style={{ color: CARDEA_DARK_GREEN }} />
              </div>
            )}
            {photoActive ? (
              <span
                className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white"
                style={{ background: CARDEA_DARK_GREEN }}
              >
                Active
              </span>
            ) : null}
          </div>
          {!compact ? (
            <div className="space-y-0.5 bg-white px-3 py-2">
              <p className="text-xs font-semibold text-[#192b3f]">Your photo</p>
              <p className="text-[10px] leading-snug" style={{ color: CARDEA_MUTED }}>
                Upload an image of your safe place
              </p>
            </div>
          ) : (
            <p className="truncate bg-white px-2 py-1.5 text-[10px] font-semibold text-[#192b3f]">Your photo</p>
          )}
        </button>
      ) : null}
    </div>
  )
}

function SafePlaceHero({
  visual,
  running,
  stepIdx,
  scriptLabel,
  stepText,
  finished,
}: {
  visual: SafePlaceVisual
  running: boolean
  stepIdx: number
  scriptLabel: string
  stepText: string
  finished: boolean
}) {
  const label =
    visual.type === 'image' ? 'Your photo' : safePlaceSceneMeta(visual.sceneId).label
  const warmth =
    visual.type === 'scene' && running && stepIdx >= 3
      ? Math.min(0.15 + (stepIdx - 3) * 0.12, 0.45)
      : 0

  return (
    <div className="overflow-hidden rounded-3xl border shadow-sm" style={{ borderColor: CARDEA_LIGHT_BLUE }}>
      <div className="relative aspect-[5/3] overflow-hidden bg-[#eef4f6]">
        <SafePlaceVisualArt
          visual={visual}
          animate={running && visual.type === 'scene'}
          warmth={warmth}
          className="absolute inset-0 h-full w-full"
        />
        <div
          className="safe-place-glow pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 35%, rgba(245,249,249,0.35) 0%, transparent 62%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
          style={{
            background:
              'linear-gradient(to top, rgba(25,43,63,0.72) 0%, rgba(25,43,63,0.18) 55%, transparent 100%)',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#c6d9e5]/90">
            {label} · {scriptLabel}
          </p>
          <p className="text-base leading-relaxed text-white sm:text-lg">
            {finished ? 'You finished the visualization.' : stepText}
          </p>
        </div>
      </div>
    </div>
  )
}

export function SafePlaceTool() {
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const formUploadInputRef = useRef<HTMLInputElement>(null)
  const [places, setPlaces] = useState<SafePlaceRow[]>([])
  const [scriptSource, setScriptSource] = useState<ScriptSource>('generic')
  const [genericScene, setGenericScene] = useState<SafePlaceSceneId>(() => loadPreferredScene())
  const [genericImageUrl, setGenericImageUrl] = useState<string | null>(() => loadGenericSafePlaceImage())
  const [genericUsesPhoto, setGenericUsesPhoto] = useState(() => Boolean(loadGenericSafePlaceImage()))
  const [savedPlaceScenes, setSavedPlaceScenes] = useState<Record<string, SafePlaceSceneId>>(() =>
    loadSceneMap(),
  )
  const [placeUsesPhoto, setPlaceUsesPhoto] = useState<Record<string, boolean>>({})
  const [formScene, setFormScene] = useState<SafePlaceSceneId>(DEFAULT_SAFE_PLACE_SCENE)
  const [formVisualMode, setFormVisualMode] = useState<'scene' | 'photo'>('scene')
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null)
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<'script' | 'form'>('script')
  const [stepIdx, setStepIdx] = useState(0)
  const [running, setRunning] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)

  const activePlace = useMemo(() => {
    if (scriptSource === 'generic') return null
    return places.find((p) => p.id === scriptSource) ?? null
  }, [scriptSource, places])

  const activeScene = useMemo(
    () => resolveScene(scriptSource, activePlace, genericScene, savedPlaceScenes),
    [scriptSource, activePlace, genericScene, savedPlaceScenes],
  )

  const activeVisual = useMemo(
    () =>
      resolveVisual(
        scriptSource,
        activePlace,
        genericScene,
        savedPlaceScenes,
        genericImageUrl,
        genericUsesPhoto,
        placeUsesPhoto,
      ),
    [
      scriptSource,
      activePlace,
      genericScene,
      savedPlaceScenes,
      genericImageUrl,
      genericUsesPhoto,
      placeUsesPhoto,
    ],
  )

  const steps = useMemo(() => buildScriptSteps(activePlace), [activePlace])
  const totalSeconds = useMemo(() => steps.reduce((a, s) => a + s.seconds, 0), [steps])
  const currentStep = steps[stepIdx]
  const elapsedBefore = useMemo(
    () => steps.slice(0, stepIdx).reduce((a, s) => a + s.seconds, 0),
    [steps, stepIdx],
  )
  const progress = totalSeconds > 0 ? (elapsedBefore / totalSeconds) * 100 : 0

  const formPreviewVisual = useMemo((): SafePlaceVisual => {
    if (formVisualMode === 'photo' && formPhotoPreview) {
      return { type: 'image', url: formPhotoPreview }
    }
    return { type: 'scene', sceneId: formScene }
  }, [formVisualMode, formPhotoPreview, formScene])

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

  useEffect(() => {
    if (!name.trim() && !description.trim()) return
    if (formVisualMode === 'scene') {
      setFormScene(inferSafePlaceScene(name, description))
    }
  }, [name, description, formVisualMode])

  useEffect(() => {
    return () => {
      if (formPhotoPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(formPhotoPreview)
      }
    }
  }, [formPhotoPreview])

  function clearFormPhoto() {
    if (formPhotoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(formPhotoPreview)
    }
    setFormPhotoPreview(null)
    setFormPhotoFile(null)
  }

  async function handleGenericPhotoUpload(file: File) {
    const validationError = validateSafePlaceImageFile(file)
    if (validationError) {
      setSaveError(validationError)
      return
    }
    setUploadingPhoto(true)
    setSaveError(null)
    const { url, error } = await uploadSafePlaceImage(file)
    setUploadingPhoto(false)
    if (error || !url) {
      setSaveError(error ?? 'Could not upload image.')
      return
    }
    setGenericImageUrl(url)
    saveGenericSafePlaceImage(url)
    setGenericUsesPhoto(true)
    if (scriptSource === 'generic') {
      setStepIdx(0)
      setRunning(true)
    }
  }

  async function handleScriptUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await handleGenericPhotoUpload(file)
  }

  async function handleFormUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const validationError = validateSafePlaceImageFile(file)
    if (validationError) {
      setSaveError(validationError)
      return
    }
    clearFormPhoto()
    setFormPhotoFile(file)
    setFormPhotoPreview(URL.createObjectURL(file))
    setFormVisualMode('photo')
    setSaveError(null)
  }

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

  function selectGenericScene(sceneId: SafePlaceSceneId) {
    setGenericScene(sceneId)
    savePreferredScene(sceneId)
    setGenericUsesPhoto(false)
    if (scriptSource === 'generic') {
      setStepIdx(0)
      setRunning(true)
    }
  }

  function selectPlaceScene(sceneId: SafePlaceSceneId, placeId: string) {
    saveSceneForPlace(placeId, sceneId)
    setSavedPlaceScenes((prev) => ({ ...prev, [placeId]: sceneId }))
    setPlaceUsesPhoto((prev) => ({ ...prev, [placeId]: false }))
    setStepIdx(0)
    setRunning(true)
  }

  function openWriteForm() {
    setName('')
    setDescription('')
    setFormScene(genericScene)
    setFormVisualMode('scene')
    clearFormPhoto()
    setSaveError(null)
    setSavedMsg(false)
    setPanel('form')
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSavedMsg(false)

    let imageUrl: string | null = null
    if (formVisualMode === 'photo') {
      if (formPhotoFile) {
        const { url, error } = await uploadSafePlaceImage(formPhotoFile)
        if (error || !url) {
          setSaveError(error ?? 'Could not upload image.')
          setSaving(false)
          return
        }
        imageUrl = url
      } else {
        setSaveError('Choose a photo or switch to an illustrated scene.')
        setSaving(false)
        return
      }
    }

    const { row, error } = await insertSafePlace(name, description, { imageUrl })
    setSaving(false)
    if (error || !row) {
      setSaveError(error ?? 'Could not save.')
      return
    }
    if (formVisualMode === 'scene') {
      saveSceneForPlace(row.id, formScene)
      setSavedPlaceScenes((prev) => ({ ...prev, [row.id]: formScene }))
      setPlaceUsesPhoto((prev) => ({ ...prev, [row.id]: false }))
    } else {
      setPlaceUsesPhoto((prev) => ({ ...prev, [row.id]: true }))
    }
    setPlaces((prev) => [row, ...prev])
    setScriptSource(row.id)
    setSavedMsg(true)
    clearFormPhoto()
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
    scriptSource === 'generic' ? 'Default guide' : activePlace?.name ?? 'Saved place'

  return (
    <div className="space-y-5">
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => void handleScriptUploadChange(e)}
      />
      <input
        ref={formUploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => void handleFormUploadChange(e)}
      />

      {panel === 'script' ? (
        <>
          <SafePlaceHero
            visual={activeVisual}
            running={running}
            stepIdx={stepIdx}
            scriptLabel={scriptLabel}
            stepText={currentStep?.text ?? ''}
            finished={!running}
          />

          <div className="h-2 overflow-hidden rounded-full" style={{ background: CARDEA_LIGHT_BLUE }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${running ? progress : 100}%`, background: CARDEA_DARK_GREEN }}
            />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_MUTED }}>
            {running ? `Step ${stepIdx + 1} of ${steps.length}` : 'Complete'} · ~90 seconds · {scriptLabel}
          </p>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_MUTED }}>
              Choose a visual
            </p>
            <ScenePicker
              value={activeScene}
              compact
              onUploadClick={() => uploadInputRef.current?.click()}
              onChange={(sceneId) => {
                if (scriptSource === 'generic') {
                  selectGenericScene(sceneId)
                  return
                }
                if (activePlace) {
                  selectPlaceScene(sceneId, activePlace.id)
                }
              }}
            />
            {uploadingPhoto ? (
              <p className="mt-2 text-xs" style={{ color: CARDEA_MUTED }}>
                Uploading your photo…
              </p>
            ) : null}
            {genericUsesPhoto && scriptSource === 'generic' && genericImageUrl ? (
              <p className="mt-2 text-xs" style={{ color: CARDEA_DARK_GREEN }}>
                Using your uploaded photo. Pick a scene to switch back to illustrations.
              </p>
            ) : null}
            {activePlace?.image_url && placeUsesPhoto[activePlace.id] !== false ? (
              <p className="mt-2 text-xs" style={{ color: CARDEA_DARK_GREEN }}>
                Using your saved photo. Pick a scene to switch to an illustration.
              </p>
            ) : null}
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

          {saveError && panel === 'script' ? (
            <p className="text-sm text-[#9B1C31]">{saveError}</p>
          ) : null}

          {places.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_MUTED }}>
                Your saved places
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {places.slice(0, 4).map((place) => {
                  const sceneId =
                    savedPlaceScenes[place.id] ??
                    loadSceneForPlace(place.id, savedPlaceScenes) ??
                    inferSafePlaceScene(place.name, place.description)
                  const thumbnailVisual: SafePlaceVisual = place.image_url
                    ? { type: 'image', url: place.image_url }
                    : { type: 'scene', sceneId }
                  const selected = scriptSource === place.id
                  return (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => selectScriptSource(place.id)}
                      className={`flex overflow-hidden rounded-2xl border text-left transition-all ${
                        selected ? 'ring-2 ring-[#577568]/45' : 'hover:border-[#577568]/35'
                      }`}
                      style={{ borderColor: selected ? CARDEA_DARK_GREEN : CARDEA_LIGHT_BLUE }}
                    >
                      <div className="relative h-20 w-28 shrink-0 bg-[#eef4f6]">
                        <SafePlaceVisualArt
                          visual={thumbnailVisual}
                          className="absolute inset-0 h-full w-full"
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
                        <p className="truncate text-sm font-semibold text-[#192b3f]">{place.name}</p>
                        <p className="line-clamp-2 text-xs leading-snug" style={{ color: CARDEA_MUTED }}>
                          {place.description ||
                            (place.image_url
                              ? 'Your uploaded safe place'
                              : safePlaceSceneMeta(sceneId).tagline)}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {panel === 'form' ? (
        <div className="space-y-4 rounded-2xl border bg-white p-4" style={{ borderColor: CARDEA_LIGHT_BLUE }}>
          <div className="overflow-hidden rounded-2xl">
            <div className="relative aspect-[5/2] bg-[#eef4f6]">
              <SafePlaceVisualArt
                visual={formPreviewVisual}
                animate={formVisualMode === 'scene'}
                className="absolute inset-0 h-full w-full"
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 p-4"
                style={{
                  background: 'linear-gradient(to top, rgba(25,43,63,0.55), transparent)',
                }}
              >
                <p className="text-sm font-semibold text-white">
                  {formVisualMode === 'photo'
                    ? 'Your photo'
                    : safePlaceSceneMeta(formScene).label}
                </p>
                <p className="text-xs text-[#c6d9e5]">
                  {formVisualMode === 'photo'
                    ? 'A personal image for your safe place'
                    : safePlaceSceneMeta(formScene).tagline}
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm font-semibold text-[#192b3f]">Write your own safe place</p>
          <p className="text-xs leading-relaxed" style={{ color: CARDEA_MUTED }}>
            Pick a visual or upload your own photo, then describe the place in your own words.
          </p>

          <ScenePicker
            value={formScene}
            photoActive={formVisualMode === 'photo'}
            photoPreviewUrl={formPhotoPreview}
            onChange={(sceneId) => {
              setFormScene(sceneId)
              setFormVisualMode('scene')
              clearFormPhoto()
              setSaveError(null)
            }}
            onUploadClick={() => formUploadInputRef.current?.click()}
          />
          <p className="text-[11px]" style={{ color: CARDEA_MUTED }}>
            JPG, PNG, WebP, or GIF · up to 5 MB
          </p>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. the lake cabin)"
            className="w-full rounded-xl border bg-[#f5f9f9] px-3 py-2 text-sm outline-none"
            style={{ borderColor: CARDEA_LIGHT_BLUE }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description — what you see, hear, and feel there"
            rows={4}
            className="w-full resize-y rounded-xl border bg-[#f5f9f9] px-3 py-2 text-sm outline-none"
            style={{ borderColor: CARDEA_LIGHT_BLUE }}
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
              disabled={saving || !name.trim() || (formVisualMode === 'photo' && !formPhotoFile)}
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
