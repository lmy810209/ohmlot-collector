/** Ohmlot mark: a rounded Ω on two feet, one stroke, currentColor. */
export function OhmMark({ className = "size-6", title = "Ohmlot" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={title} fill="none">
      <path d="M4 20H8.6L8.75 16.6A6.5 6.5 0 1 1 15.25 16.6L15.4 20H20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <OhmMark className="size-6 text-accent" />
      <span className="text-[17px] font-bold tracking-[-0.03em]">Ohmlot</span>
    </span>
  );
}
