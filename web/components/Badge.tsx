import type { ReactNode } from "react";

/** Status pill. Tones map to the reserved status tokens; "info" is the brand tint for non-state labels. */
type Tone = "neutral" | "good" | "warn" | "critical" | "info";

const TONE: Record<Tone, string> = {
  neutral: "border-border bg-transparent text-muted-foreground",
  good: "border-good/25 bg-good-soft text-good",
  warn: "border-caution/25 bg-caution-soft text-caution",
  critical: "border-critical/25 bg-critical-soft text-critical",
  info: "border-brand/25 bg-brand-soft text-brand-strong",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex h-5 items-center whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-none ${TONE[tone]}`}>
      {children}
    </span>
  );
}
