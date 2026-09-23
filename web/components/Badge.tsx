import type { ReactNode } from "react";

/** Pill badge (guide §3). Status = up/amber; tracked = accent-soft + mono; neutral for unknowns; down for warnings. */
export type Tone = "up" | "amber" | "down" | "accent" | "neutral";

const TONE: Record<Tone, string> = {
  up: "bg-up-soft text-up",
  amber: "bg-amber-soft text-amber",
  down: "bg-down-soft text-down",
  accent: "bg-accent-soft text-accent-ink",
  neutral: "bg-sunk text-ink-2",
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
