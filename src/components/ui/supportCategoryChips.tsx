/** Category chip row for Find Support (solid navy when active). */
export function SupportCategoryChips<T extends string>({
  options,
  active,
  onChange,
  allOption,
}: {
  options: readonly T[]
  active: T
  onChange: (c: T) => void
  /** Clicking the active chip again clears the filter (e.g. back to All). */
  allOption: T
}) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {options.map((cat) => {
        const isActive = cat === active
        return (
          <button
            key={cat}
            type="button"
            onClick={() => {
              if (isActive && cat !== allOption) onChange(allOption)
              else if (!isActive) onChange(cat)
            }}
            style={{
              padding: '8px 18px',
              borderRadius: 999,
              fontSize: '0.8rem',
              fontWeight: 600,
              fontFamily: 'Inter, system-ui, sans-serif',
              cursor: 'pointer',
              border: isActive ? 'none' : '1px solid rgba(25, 43, 63, 0.12)',
              background: isActive ? '#192b3f' : '#ffffff',
              color: isActive ? '#ffffff' : '#192b3f',
              transition: 'all 0.15s ease',
            }}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}
