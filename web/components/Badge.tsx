import type { ReactNode } from "react";

/**
 * Pill badge (guide §3). Status = up/amber; tracked = accent-soft + mono; neutral for plain facts; outline for a
 * settled fact that must not read as good or bad (US status "before"); muted = grey fill for "unknown"; down for warnings.
 * Text tones stay at or above 4.5:1 on their fill in both schemes (ink-2 on sunk ≈ 5:1 light / 7:1 dark).
 */
export type Tone = "up" | "amber" | "down" | "accent" | "neutral" | "outline" | "muted";

const TONE: Record<Tone, string> = {
  up: "bg-up-soft text-up",
  amber: "bg-amber-soft text-amber",
  down: "bg-down-soft text-down",
  accent: "bg-accent-soft text-accent-ink",
  neutral: "bg-sunk text-ink-2",
  outline: "bg-card text-ink ring-1 ring-inset ring-line",
  muted: "bg-sunk text-ink-2",
};

export function Badge({ tone = "neutral", mono = false, children }: { tone?: Tone; mono?: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2.5 leading-none ${TONE[tone]} ${
        mono ? "font-mono text-[10.5px] font-medium tracking-[0.08em] uppercase" : "text-[12px] font-medium"
      }`}
    >
      {children}
    </span>
  );
}
