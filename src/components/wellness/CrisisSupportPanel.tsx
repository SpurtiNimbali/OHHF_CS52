import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ChevronLeft, ChevronRight, MessageCircle, Phone, Users, Wind } from 'lucide-react'
import { CRISIS_RESOURCES } from '../../lib/crisisKeywords'
import {
  CARDEA_DARK_GREEN,
  CARDEA_FONT_PRIMARY,
  CARDEA_MUTED,
  CARDEA_NAVY,
} from '../../ui/cardeaTokens'

type CalmingToolId = 'breathing' | 'grounding' | 'safe-place' | 'physical-regulation'

type CrisisSupportPanelProps = {
  onOpenTool?: (toolId: CalmingToolId) => void
}

const PANEL_PHASES = [
  { id: 'pause', label: 'Pause' },
  { id: 'hotlines', label: 'Talk to someone' },
  { id: 'cardea', label: 'Cardea support' },
  { id: 'reset', label: 'Short reset' },
] as const

const GROUNDING_PROMPTS = [
  {
    question: 'Where are you right now?',
    hint: 'Even roughly — "my room," "the car," "outside." No detail required.',
  },
  {
    question: 'What is one thing touching your body?',
    hint: 'A chair, the floor, a blanket, your hands together.',
  },
  {
    question: 'What is one thing you can see or hear?',
    hint: 'Name it quietly to yourself. Just one is enough.',
  },
]

const RESET_STEPS = [
  'Put both feet on the floor and notice the support beneath you.',
  'Name one safe object you can see right now.',
  'Take one slow breath — a longer exhale than inhale.',
  'Reach out: text or call someone you trust, or use a hotline from the previous step.',
]

function phoneHref(number: string): string | null {
  const digits = number.replace(/\D/g, '')
  if (digits.length >= 3 && digits.length <= 15) return `tel:${digits}`
  return null
}

function PhaseDots({ phase }: { phase: number }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {PANEL_PHASES.map((p, i) => (
        <div key={p.id} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full transition-colors"
            style={{
              background: i === phase ? CARDEA_DARK_GREEN : i < phase ? 'rgba(87,117,104,0.45)' : 'rgba(25,43,63,0.12)',
            }}
            aria-hidden
          />
          {i < PANEL_PHASES.length - 1 ? (
            <span className="h-px w-4 bg-[rgba(25,43,63,0.08)]" aria-hidden />
          ) : null}
        </div>
      ))}
      <span className="sr-only">
        Step {phase + 1} of {PANEL_PHASES.length}: {PANEL_PHASES[phase].label}
      </span>
    </div>
  )
}

function NavButtons({
  phase,
  onBack,
  onNext,
  nextLabel = 'Continue',
}: {
  phase: number
  onBack: () => void
  onNext: () => void
  nextLabel?: string
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4" style={{ borderColor: 'rgba(25,43,63,0.08)' }}>
      {phase > 0 ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-semibold text-[#192b3f]"
          style={{ borderColor: 'rgba(25,43,63,0.12)' }}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold text-white"
        style={{ background: phase === 1 ? '#9B1C31' : CARDEA_DARK_GREEN }}
      >
        {nextLabel}
        {phase < PANEL_PHASES.length - 1 ? <ChevronRight className="h-4 w-4" aria-hidden /> : null}
      </button>
    </div>
  )
}

export function CrisisSupportPanel({ onOpenTool }: CrisisSupportPanelProps) {
  const [phase, setPhase] = useState(0)
  const [promptIndex, setPromptIndex] = useState(0)
  const [resetIndex, setResetIndex] = useState(0)

  return (
    <div className="rounded-2xl border bg-[#fafcfc] p-4 sm:p-5" style={{ borderColor: 'rgba(25,43,63,0.08)', fontFamily: CARDEA_FONT_PRIMARY }}>
      <PhaseDots phase={phase} />
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_MUTED }}>
        {PANEL_PHASES[phase].label}
      </p>

      {phase === 0 ? (
        <div>
          <p className="text-base leading-relaxed text-[#192b3f]">
            You opened this because something feels hard right now. That&apos;s okay — you don&apos;t have to fix
            everything in this moment.
          </p>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
            Let&apos;s go slowly. There are no wrong answers — just gentle questions to help you land here.
          </p>

          <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: CARDEA_MUTED }}>
              Grounding {promptIndex + 1} of {GROUNDING_PROMPTS.length}
            </p>
            <p className="mt-2 text-sm font-semibold text-[#192b3f]">
              {GROUNDING_PROMPTS[promptIndex].question}
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
              {GROUNDING_PROMPTS[promptIndex].hint}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {promptIndex < GROUNDING_PROMPTS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setPromptIndex((i) => i + 1)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: CARDEA_DARK_GREEN }}
                >
                  Next question
                </button>
              ) : null}
              {promptIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => setPromptIndex((i) => i - 1)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-[#192b3f]"
                  style={{ borderColor: 'rgba(25,43,63,0.12)' }}
                >
                  Previous
                </button>
              ) : null}
            </div>
          </div>

          <NavButtons phase={phase} onBack={() => setPhase(0)} onNext={() => setPhase(1)} nextLabel="Continue when ready" />
        </div>
      ) : null}

      {phase === 1 ? (
        <div>
          <p className="text-sm leading-relaxed text-[#192b3f]">
            Are you worried you might hurt yourself or someone else — or need help right this second?
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
            If yes, please reach out now. These lines are free, confidential, and available 24/7 in the U.S.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="tel:988"
              className="inline-flex items-center gap-2 rounded-xl bg-[#9B1C31] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <Phone className="h-4 w-4" aria-hidden />
              Call or text 988
            </a>
            <a
              href="tel:911"
              className="inline-flex items-center gap-2 rounded-xl border border-[#9B1C31]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#9B1C31]"
            >
              Call 911
            </a>
          </div>

          <details className="mt-4 rounded-xl border bg-white p-3" style={{ borderColor: 'rgba(25,43,63,0.08)' }}>
            <summary className="cursor-pointer text-sm font-semibold text-[#192b3f]">
              More crisis lines
            </summary>
            <ul className="mt-3 space-y-2">
              {CRISIS_RESOURCES.filter((r) => r.number !== '988').map((resource) => {
                const href = resource.number.startsWith('http')
                  ? resource.number
                  : phoneHref(resource.number)
                return (
                  <li key={resource.name} className="rounded-lg bg-[#f5f9f9] p-2.5">
                    <p className="text-sm font-semibold text-[#192b3f]">{resource.name}</p>
                    <p className="text-xs" style={{ color: CARDEA_MUTED }}>{resource.description}</p>
                    {href ? (
                      <a
                        href={href}
                        target={href.startsWith('http') ? '_blank' : undefined}
                        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="mt-1 inline-block text-xs font-semibold text-[#9B1C31] underline-offset-2 hover:underline"
                      >
                        {resource.number}
                      </a>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-[#9B1C31]">{resource.number}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          </details>

          <NavButtons phase={phase} onBack={() => setPhase(0)} onNext={() => setPhase(2)} />
        </div>
      ) : null}

      {phase === 2 ? (
        <div>
          <p className="text-sm leading-relaxed text-[#192b3f]">
            If you&apos;re not in immediate danger, Cardea can sit with you here — alongside real-world support,
            not instead of it.
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
            What might help next?
          </p>

          <div className="mt-4 grid gap-2">
            <Link
              to="/chat"
              className="flex items-start gap-3 rounded-xl border bg-white p-3 transition hover:shadow-sm"
              style={{ borderColor: 'rgba(25,43,63,0.08)' }}
            >
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: CARDEA_DARK_GREEN }} aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[#192b3f]">Chat with Cardea</p>
                <p className="text-xs leading-relaxed" style={{ color: CARDEA_MUTED }}>
                  Talk through what you&apos;re feeling — messy is fine.
                </p>
              </div>
            </Link>
            <Link
              to="/resources?view=support"
              className="flex items-start gap-3 rounded-xl border bg-white p-3 transition hover:shadow-sm"
              style={{ borderColor: 'rgba(25,43,63,0.08)' }}
            >
              <Users className="mt-0.5 h-4 w-4 shrink-0" style={{ color: CARDEA_DARK_GREEN }} aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[#192b3f]">Find support near you</p>
                <p className="text-xs leading-relaxed" style={{ color: CARDEA_MUTED }}>
                  Peer groups and organizations for heart families.
                </p>
              </div>
            </Link>
            <Link
              to="/resources"
              className="flex items-start gap-3 rounded-xl border bg-white p-3 transition hover:shadow-sm"
              style={{ borderColor: 'rgba(25,43,63,0.08)' }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: CARDEA_NAVY }} aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[#192b3f]">Learning &amp; resources</p>
                <p className="text-xs leading-relaxed" style={{ color: CARDEA_MUTED }}>
                  Glossary, visit questions, and heart health education.
                </p>
              </div>
            </Link>
          </div>

          {onOpenTool ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: CARDEA_MUTED }}>
                Or try a calming tool
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['breathing', 'Breathing'],
                    ['grounding', 'Grounding'],
                    ['safe-place', 'Safe place'],
                    ['physical-regulation', 'Body regulation'],
                  ] as const
                ).map(([toolId, label]) => (
                  <button
                    key={toolId}
                    type="button"
                    onClick={() => onOpenTool(toolId)}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-[#192b3f] transition hover:bg-[#f5f9f9]"
                    style={{ borderColor: 'rgba(25,43,63,0.12)' }}
                  >
                    <Wind className="h-3 w-3" style={{ color: CARDEA_DARK_GREEN }} aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <NavButtons phase={phase} onBack={() => setPhase(1)} onNext={() => setPhase(3)} />
        </div>
      ) : null}

      {phase === 3 ? (
        <div>
          <p className="text-sm leading-relaxed text-[#192b3f]">
            One more minute, just for you — a short reset to steady your body. This does not replace crisis care.
          </p>
          <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: CARDEA_MUTED }}>
              Reset step {resetIndex + 1} of {RESET_STEPS.length}
            </p>
            <p className="mt-2 text-base font-medium leading-relaxed text-[#192b3f]">
              {RESET_STEPS[resetIndex]}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {resetIndex < RESET_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setResetIndex((i) => i + 1)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: CARDEA_DARK_GREEN }}
                >
                  Next step
                </button>
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
                  Stay here as long as you need. You can go back for hotlines or Cardea links anytime.
                </p>
              )}
              {resetIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => setResetIndex((i) => i - 1)}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold text-[#192b3f]"
                  style={{ borderColor: 'rgba(25,43,63,0.12)' }}
                >
                  Back
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4" style={{ borderColor: 'rgba(25,43,63,0.08)' }}>
            <button
              type="button"
              onClick={() => setPhase(2)}
              className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-semibold text-[#192b3f]"
              style={{ borderColor: 'rgba(25,43,63,0.12)' }}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase(0)
                setPromptIndex(0)
                setResetIndex(0)
              }}
              className="text-xs font-semibold underline-offset-2 hover:underline"
              style={{ color: CARDEA_MUTED }}
            >
              Start over gently
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
