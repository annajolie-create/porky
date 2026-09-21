'use client'

export function OpeningScreen({ label }: { label: string }) {
  return (
    <div className="h-full grid place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <p className="font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">{label}</p>
        <span className="inline-flex items-center gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-gold loading-dot" />
          <span className="size-2 rounded-full bg-gold loading-dot [animation-delay:160ms]" />
          <span className="size-2 rounded-full bg-gold loading-dot [animation-delay:320ms]" />
        </span>
      </div>
    </div>
  )
}
