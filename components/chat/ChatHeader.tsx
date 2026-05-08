'use client'

export default function ChatHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
      <h1 className="text-base font-semibold text-slate-800 tracking-tight">
        Mental Health Support
      </h1>

      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-sm text-slate-500 font-medium">Available</span>
      </div>
    </header>
  )
}
