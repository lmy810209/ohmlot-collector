"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { PriceSeries } from "@/lib/data";
import { fmtDate, usd } from "@/lib/format";

const PAD = { top: 12, right: 16, bottom: 28, left: 60 };
const HEIGHT = 240;
const MAX_SERIES = 8; // one fixed categorical slot per series; past 8 the chart falls back to the table view

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min = min * 0.9;
    max = max * 1.1 || 1;
  }
  const rough = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

export function PriceChart({ dates, series }: { dates: string[]; series: PriceSeries[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shown = series.slice(0, MAX_SERIES);
  const layout = useMemo(() => {
    const prices = shown.flatMap((s) => s.points.map((p) => p.price));
    const ticks = niceTicks(Math.min(...prices), Math.max(...prices));
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (dates.length === 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
    return { ticks, innerW, innerH, x, y };
  }, [shown, dates.length, width]);

  const dateIndex = useMemo(() => new Map(dates.map((d, i) => [d, i])), [dates]);

  function indexFromClientX(clientX: number, target: Element) {
    const rect = target.getBoundingClientRect();
    const px = clientX - rect.left - PAD.left;
    const raw = dates.length === 1 ? 0 : Math.round((px / layout.innerW) * (dates.length - 1));
    return Math.min(dates.length - 1, Math.max(0, raw));
  }

  function onMove(e: PointerEvent<SVGRectElement>) {
    setHover(indexFromClientX(e.clientX, e.currentTarget.ownerSVGElement ?? e.currentTarget));
  }
  function onKey(e: KeyboardEvent<SVGRectElement>) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const cur = hover ?? dates.length - 1;
      setHover(Math.min(dates.length - 1, Math.max(0, cur + (e.key === "ArrowLeft" ? -1 : 1))));
    }
    if (e.key === "Escape") setHover(null);
  }

  const xLabels = dates.length <= 3 ? dates.map((d, i) => i) : [0, Math.floor((dates.length - 1) / 2), dates.length - 1];
  const tooltipLeft = hover == null ? 0 : layout.x(hover) + 12 > width - 200 ? layout.x(hover) - 212 : layout.x(hover) + 12;

  return (
    <div ref={wrap} className="viz-root relative">
      <svg width={width} height={HEIGHT} role="img" aria-label="Price history by seller and variant" className="block max-w-full">
        {layout.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={layout.y(t)} y2={layout.y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 8} y={layout.y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
              {usd(t)}
            </text>
          </g>
        ))}
        {xLabels.map((i) => (
          <text
            key={i}
            x={layout.x(i)}
            y={HEIGHT - 8}
            textAnchor={dates.length === 1 ? "middle" : i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"}
            fontSize={11}
            fill="var(--text-muted)"
          >
            {fmtDate(dates[i])}
          </text>
        ))}
        {hover != null && (
          <line x1={layout.x(hover)} x2={layout.x(hover)} y1={PAD.top} y2={PAD.top + layout.innerH} stroke="var(--text-muted)" strokeWidth={1} />
        )}
        {shown.map((s, si) => {
          const color = `var(--series-${si + 1})`;
          const pts = s.points.map((p) => [layout.x(dateIndex.get(p.date) ?? 0), layout.y(p.price)] as const);
          const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px} ${py}`).join(" ");
          return (
            <g key={s.key}>
              {pts.length > 1 && <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
              {pts.map(([px, py], i) => (
                <circle key={i} cx={px} cy={py} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          );
        })}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={layout.innerW}
          height={layout.innerH}
          fill="transparent"
          tabIndex={0}
          aria-label="Move the crosshair with the arrow keys"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(dates.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
          style={{ outline: "none", cursor: "crosshair" }}
        />
      </svg>

      {hover != null && (
        <div
          className="pointer-events-none absolute top-2 w-[200px] rounded-md border border-border bg-popover p-2 text-xs shadow-md"
          style={{ left: tooltipLeft }}
        >
          <div className="mb-1 font-medium">{fmtDate(dates[hover])}</div>
          <ul className="space-y-0.5">
            {shown.map((s, si) => {
              const p = s.points.find((pt) => pt.date === dates[hover]);
              return (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-3 shrink-0" style={{ background: `var(--series-${si + 1})` }} />
                  <span className="font-semibold tabular-nums">{p ? usd(p.price) : "—"}</span>
                  <span className="truncate text-muted-foreground">{s.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {shown.length >= 2 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {shown.map((s, si) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ background: `var(--series-${si + 1})` }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {series.length > MAX_SERIES && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {MAX_SERIES} of {series.length} variants. The table below has all of them.
        </p>
      )}
    </div>
  );
}
