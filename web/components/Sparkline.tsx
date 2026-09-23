/** Tiny price trend: cheapest tracked price per snapshot. Muted line, brand dot on the current value. */
export function Sparkline({ values, width = 72, height = 22, className = "" }: { values: number[]; width?: number; height?: number; className?: string }) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 3;
  const x = (i: number) => (values.length === 1 ? width / 2 : pad + (i / (values.length - 1)) * (width - pad * 2));
  const y = (v: number) => (max === min ? height / 2 : pad + (1 - (v - min) / (max - min)) * (height - pad * 2));
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={`shrink-0 ${className}`} aria-hidden="true">
      {values.length > 1 && (
        <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/70" />
      )}
      <circle cx={x(last)} cy={y(values[last])} r={2.5} className="fill-brand" />
    </svg>
  );
}
