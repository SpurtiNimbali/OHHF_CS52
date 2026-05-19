import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CareTeamIntakeAnswers, CareTeamIntakeOption } from '../../lib/careTeamQuestionIntake'
import {
  CARE_TEAM_KNOWLEDGE_OPTIONS,
  CARE_TEAM_PROVIDER_OPTIONS,
  CARE_TEAM_TARGET_PERSON_OPTIONS,
  CARE_TEAM_VISIT_TYPE_OPTIONS,
  labelsForIntakeValues,
} from '../../lib/careTeamQuestionIntake'

const NAVY = '#192b3f'
const LIGHT_BLUE = '#c6d9e5'
const DARK_GREEN = '#577568'
const MUTED_GREEN = '#acb7a8'

const triggerClass =
  'w-full rounded-xl border-2 bg-white/95 px-4 py-3 text-sm text-[#192b3f] outline-none focus:ring-2 focus:ring-[rgba(87,117,104,0.35)] sm:text-base'

type Props = {
  value: CareTeamIntakeAnswers
  onChange: (next: CareTeamIntakeAnswers) => void
}

function FieldLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <label htmlFor={id} className="mb-1 block text-sm font-semibold" style={{ color: NAVY }}>
      {children}
    </label>
  )
}

function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-xs leading-relaxed" style={{ color: MUTED_GREEN }}>
      {children}
    </p>
  )
}

function DropdownRoot({ children, rootRef }: { children: ReactNode; rootRef: Ref<HTMLDivElement> }) {
  return (
    <div ref={rootRef} className="relative">
      {children}
    </div>
  )
}

function useCloseOnClickOutside(
  open: boolean,
  setOpen: (open: boolean) => void,
  rootRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, setOpen, rootRef])
}

function DropdownTrigger({
  id,
  open,
  onToggle,
  listId,
  placeholder,
  label,
}: {
  id: string
  open: boolean
  onToggle: () => void
  listId: string
  placeholder: string
  label: string
}) {
  const muted = label === placeholder
  return (
    <button
      id={id}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      onClick={onToggle}
      className={`${triggerClass} flex items-center justify-between text-left`}
      style={{
        borderColor: open ? DARK_GREEN : LIGHT_BLUE,
        boxShadow: '0 2px 12px rgba(25, 43, 63, 0.06)',
      }}
    >
      <span className={muted ? 'text-[#acb7a8]' : undefined}>{label}</span>
      <ChevronDown
        className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        style={{ color: MUTED_GREEN }}
        aria-hidden
      />
    </button>
  )
}

function DropdownPanel({
  listId,
  multi,
  children,
}: {
  listId: string
  multi?: boolean
  children: ReactNode
}) {
  return (
    <ul
      id={listId}
      role="listbox"
      aria-multiselectable={multi ? true : undefined}
      className="absolute z-20 mt-1 max-h-56 w-full list-none overflow-y-auto rounded-xl border-2 bg-white p-1 shadow-lg"
      style={{ borderColor: LIGHT_BLUE }}
    >
      {children}
    </ul>
  )
}

function CheckboxIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-[10px] font-bold text-white"
      style={{
        borderColor: checked ? DARK_GREEN : LIGHT_BLUE,
        background: checked ? DARK_GREEN : '#fff',
      }}
      aria-hidden
    >
      {checked ? '✓' : ''}
    </span>
  )
}

function RadioIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
      style={{
        borderColor: selected ? DARK_GREEN : LIGHT_BLUE,
        background: '#fff',
      }}
      aria-hidden
    >
      {selected ? <span className="h-2 w-2 rounded-full" style={{ background: DARK_GREEN }} /> : null}
    </span>
  )
}

function OptionButton({
  selected,
  multi,
  onClick,
  children,
}: {
  selected: boolean
  multi: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#f5f9f9]"
      style={{ color: NAVY, background: selected ? 'rgba(198, 217, 229, 0.35)' : undefined }}
    >
      {multi ? <CheckboxIndicator checked={selected} /> : <RadioIndicator selected={selected} />}
      {children}
    </button>
  )
}

function IntakeSelect({
  id,
  legend,
  hint,
  placeholder,
  options,
  value,
  onChange,
}: {
  id: string
  legend: string
  hint?: string
  placeholder: string
  options: CareTeamIntakeOption[]
  value: string | null
  onChange: (value: string | null) => void
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useCloseOnClickOutside(open, setOpen, rootRef)

  const selectedLabel = value
    ? (options.find((o) => o.value === value)?.label ?? value)
    : null
  const buttonLabel = selectedLabel ?? placeholder

  const pick = (val: string) => {
    onChange(val)
    setOpen(false)
  }

  return (
    <DropdownRoot rootRef={rootRef}>
      <FieldLabel id={id}>{legend}</FieldLabel>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <DropdownTrigger
        id={id}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        listId={listId}
        placeholder={placeholder}
        label={buttonLabel}
      />
      {open ? (
        <DropdownPanel listId={listId}>
          {options.map((opt) => {
            const selected = value === opt.value
            return (
              <li key={opt.value} role="option" aria-selected={selected}>
                <OptionButton selected={selected} multi={false} onClick={() => pick(opt.value)}>
                  {opt.label}
                </OptionButton>
              </li>
            )
          })}
        </DropdownPanel>
      ) : null}
    </DropdownRoot>
  )
}

function IntakeMultiSelect({
  id,
  legend,
  hint,
  placeholder,
  options,
  selected,
  onChange,
}: {
  id: string
  legend: string
  hint?: string
  placeholder: string
  options: CareTeamIntakeOption[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useCloseOnClickOutside(open, setOpen, rootRef)

  const selectedLabels = labelsForIntakeValues(options, selected)
  let buttonLabel = placeholder
  if (selected.length === 1) buttonLabel = selectedLabels[0] ?? placeholder
  else if (selected.length > 1) buttonLabel = `${selected.length} selected`

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val])
  }

  return (
    <DropdownRoot rootRef={rootRef}>
      <FieldLabel id={id}>{legend}</FieldLabel>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <DropdownTrigger
        id={id}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        listId={listId}
        placeholder={placeholder}
        label={buttonLabel}
      />
      {open ? (
        <DropdownPanel listId={listId} multi>
          {options.map((opt) => {
            const checked = selected.includes(opt.value)
            return (
              <li key={opt.value} role="option" aria-selected={checked}>
                <OptionButton selected={checked} multi onClick={() => toggle(opt.value)}>
                  {opt.label}
                </OptionButton>
              </li>
            )
          })}
        </DropdownPanel>
      ) : null}
    </DropdownRoot>
  )
}

export function CareTeamIntakeForm({ value, onChange }: Props) {
  const patch = (partial: Partial<CareTeamIntakeAnswers>) => onChange({ ...value, ...partial })
  const providerId = useId()
  const visitId = useId()
  const targetId = useId()
  const knowledgeId = useId()

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="relative sm:col-span-2">
        <IntakeMultiSelect
          id={providerId}
          legend="What type of care team are you seeing?"
          hint="Select all that apply."
          placeholder="Select care team type(s)…"
          options={CARE_TEAM_PROVIDER_OPTIONS}
          selected={value.providerTypes}
          onChange={(providerTypes) => patch({ providerTypes })}
        />
      </div>

      <div className="relative sm:col-span-2">
        <IntakeMultiSelect
          id={visitId}
          legend="What kind of appointment is this?"
          hint="Select all that apply."
          placeholder="Select appointment type(s)…"
          options={CARE_TEAM_VISIT_TYPE_OPTIONS}
          selected={value.visitTypes}
          onChange={(visitTypes) => patch({ visitTypes })}
        />
      </div>

      <div className="relative">
        <IntakeSelect
          id={targetId}
          legend="Who are you preparing questions for?"
          placeholder="Select one…"
          options={CARE_TEAM_TARGET_PERSON_OPTIONS}
          value={value.targetPerson}
          onChange={(targetPerson) => patch({ targetPerson })}
        />
      </div>

      <div className="relative">
        <IntakeSelect
          id={knowledgeId}
          legend="How familiar are you with this type of visit?"
          placeholder="Select one…"
          options={CARE_TEAM_KNOWLEDGE_OPTIONS}
          value={value.knowledgeLevel}
          onChange={(knowledgeLevel) => patch({ knowledgeLevel })}
        />
      </div>

      <IntakeNotesField value={value} onChange={onChange} />
    </div>
  )
}

function IntakeNotesField({
  value,
  onChange,
}: {
  value: CareTeamIntakeAnswers
  onChange: (next: CareTeamIntakeAnswers) => void
}) {
  return (
    <div className="sm:col-span-2">
      <label htmlFor="care-team-intake-notes" className="mb-1 block text-sm font-semibold" style={{ color: NAVY }}>
        Anything else we should know?{' '}
        <span className="font-normal" style={{ color: MUTED_GREEN }}>
          (optional)
        </span>
      </label>
      <FieldHint>Worries, recent changes, or topics you already want to cover.</FieldHint>
      <textarea
        id="care-team-intake-notes"
        rows={3}
        value={value.additionalNotes}
        onChange={(e) => onChange({ ...value, additionalNotes: e.target.value })}
        placeholder="For example: first surgery consult, nervous about recovery at home…"
        className="min-h-[4.5rem] w-full resize-y rounded-xl border-2 bg-white/95 px-4 py-3 text-sm outline-none focus:ring-2 sm:text-base"
        style={{
          borderColor: LIGHT_BLUE,
          color: NAVY,
          boxShadow: '0 2px 12px rgba(25, 43, 63, 0.06)',
        }}
      />
    </div>
  )
}
