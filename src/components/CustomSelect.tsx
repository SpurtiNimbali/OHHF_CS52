import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

export type CustomSelectOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
}

export type CustomSelectProps<T extends string> = {
  id?: string
  label: string
  options: Array<CustomSelectOption<T>>
  value: T | null
  placeholder: string
  onChange: (next: T | null) => void
  width?: number | string
  maxWidth?: number | string
}

/** App “dark blue” — keep in sync with onboarding (`#0A2E5C`). */
const palette = {
  navy: '#0A2E5C',
  lightBlue: '#C6D9E5',
  almostWhite: '#F1F5F9',
  lightGreen: '#ACB7A8',
  darkGreen: '#577568',
} as const

function useClickOutside(
  refs: Array<React.RefObject<HTMLElement | null>>,
  onOutside: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null
      if (!target) return

      const clickedInside = refs.some((ref) => {
        const el = ref.current
        return el ? el.contains(target) : false
      })

      if (!clickedInside) onOutside()
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [enabled, onOutside, refs])
}

export function CustomSelect<T extends string>({
  id,
  label,
  options,
  value,
  placeholder,
  onChange,
  width = '100%',
  maxWidth = 520,
}: CustomSelectProps<T>) {
  const autoId = useId()
  const baseId = id ?? `ohhf-select-${autoId}`

  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  const enabledOptions = useMemo(
    () => options.filter((opt) => !opt.disabled),
    [options],
  )

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value],
  )

  const selectedIndex = useMemo(() => {
    if (value == null) return -1
    return enabledOptions.findIndex((opt) => opt.value === value)
  }, [enabledOptions, value])

  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, selectedIndex),
  )

  useEffect(() => {
    if (!open) return
    setActiveIndex(Math.max(0, selectedIndex))
  }, [open, selectedIndex])

  useClickOutside([buttonRef, listRef], () => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  function commitByIndex(idx: number) {
    const opt = enabledOptions[idx]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onButtonKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen((prev) => !prev)
    }
  }

  function onListKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, enabledOptions.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(enabledOptions.length - 1)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      commitByIndex(activeIndex)
    }
  }

  return (
    <div style={{ width, maxWidth, marginTop: 8, position: 'relative' }}>
      <span
        id={`${baseId}-label`}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        {label}
      </span>

      <button
        ref={buttonRef}
        id={baseId}
        type="button"
        aria-labelledby={`${baseId}-label ${baseId}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onButtonKeyDown}
        style={{
          width: '100%',
          borderRadius: 14,
          padding: '14px 16px',
          fontSize: 16,
          fontWeight: 500,
          border: value
            ? `2px solid ${palette.darkGreen}`
            : '2px solid rgba(10, 46, 92, 0.22)',
          background: value ? 'rgba(172, 183, 168, 0.5)' : palette.almostWhite,
          color: value ? palette.darkGreen : palette.navy,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
        }}
      >
        <span style={{ textAlign: 'left' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span aria-hidden="true" style={{ opacity: 0.7, fontWeight: 800 }}>
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${baseId}-label`}
          onKeyDown={onListKeyDown}
          style={{
            position: 'absolute',
            zIndex: 20,
            top: 'calc(100% + 10px)',
            left: 0,
            right: 0,
            borderRadius: 16,
            padding: 10,
            background: '#FFFFFF',
            border: '1px solid rgba(10, 46, 92, 0.14)',
            boxShadow: '0 20px 48px rgba(15, 23, 42, 0.18)',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {options.map((opt) => {
            const enabledIdx = enabledOptions.findIndex(
              (o) => o.value === opt.value,
            )
            const isDisabled = Boolean(opt.disabled)
            const isActive = !isDisabled && enabledIdx === activeIndex
            const isSelected = value === opt.value

            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled || undefined}
                onMouseEnter={() => {
                  if (isDisabled) return
                  setActiveIndex(Math.max(0, enabledIdx))
                }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (isDisabled) return
                  onChange(opt.value)
                  setOpen(false)
                  buttonRef.current?.focus()
                }}
                style={{
                  padding: '14px 14px',
                  borderRadius: 14,
                  fontSize: 16,
                  fontWeight: isDisabled ? 400 : 500,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  background: isActive
                    ? 'rgba(172, 183, 168, 0.62)'
                    : isSelected
                      ? 'rgba(172, 183, 168, 0.5)'
                      : 'transparent',
                  color: isDisabled
                    ? 'rgba(10, 46, 92, 0.35)'
                    : isSelected
                      ? palette.darkGreen
                      : palette.navy,
                  outline: isActive ? `2px solid rgba(87, 117, 104, 0.5)` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <span aria-hidden="true" style={{ opacity: 0.75 }}>
                    ✓
                  </span>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => {
              onChange(null)
              setOpen(false)
              buttonRef.current?.focus()
            }}
            style={{
              width: '100%',
              marginTop: 8,
              borderRadius: 14,
              padding: '12px 14px',
              border: '1px dashed rgba(10, 46, 92, 0.32)',
              background: 'rgba(241, 245, 249, 0.75)',
              cursor: 'pointer',
              color: palette.navy,
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  )
}

