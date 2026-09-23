import { pct as fmtPct, signedUsd, usd } from "@/lib/format";

/** ▲/▼ + amount (guide §3). Color comes only from the up/down tokens; no change is quiet. */
export function Delta({ amount, pct, mode = "amount", className = "" }: { amount: number; pct: number; mode?: "amount" | "pct"; className?: string }) {
  if (amount === 0) {
    return (
      <span className={`num text-ink-3 ${className}`} title="No change since the previous snapshot">
        — {usd(0)}
      </span>
    );
  }
  const up = amount > 0;
  const text = mode === "pct" ? fmtPct(pct) : signedUsd(amount).replace(/^[+−]/, "");
  return (
    <span className={`num ${up ? "text-up" : "text-down"} ${className}`} title={`${signedUsd(amount)} (${fmtPct(pct)})`}>
      {up ? "▲" : "▼"} {text}
    </span>
  );
}
