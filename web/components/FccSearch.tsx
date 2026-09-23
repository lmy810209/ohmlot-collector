"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FccSearchItem, UsStatusKind } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { UsStatusBadge, usStatusLabel } from "./UsStatusBadge";

type StatusFilter = UsStatusKind | "all";
const STATUS_ORDER: UsStatusKind[] = ["before", "conditional", "after", "unknown"];

export function FccSearch({ items }: { items: FccSearchItem[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    const c: Record<UsStatusKind, number> = { before: 0, conditional: 0, after: 0, unknown: 0 };
    for (const it of items) c[it.status]++;
    return c;
  }, [items]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (status !== "all" && it.status !== status) return false;
      if (!needle) return true;
      return [it.fcc_id, it.grantee_code, it.model_name, it.manufacturer, it.description]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(needle));
    });
  }, [items, q, status]);

  // Same chip pattern as the home quick filters (accent-soft when pressed); empty states are not offered.
  const chip = (value: StatusFilter, label: string, count: number) => {
    const on = status === value;
    const empty = count === 0 && !on;
    return (
      <button
        key={value}
        type="button"
        aria-pressed={on}
        disabled={empty}
        onClick={() => setStatus(value)}
        className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150 ${
          on ? "border-accent/40 bg-accent-soft text-accent-ink" : "border-line bg-card text-ink-2 hover:bg-sunk hover:text-ink"
        } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card disabled:hover:text-ink-2`}
      >
        {label}
        <span className="num text-[11px] text-ink-2">{count}</span>
      </button>
    );
  };

  return (
    <div>
      <label htmlFor="fcc-q" className="sr-only">
        Search by model name or FCC ID
      </label>
      <input
        id="fcc-q"
        type="search"
        autoFocus
        placeholder="Model name, manufacturer, or FCC ID (e.g. 2A5PE-YUSHU008)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-12 w-full rounded-ctl border border-line bg-card px-4 text-[15px] text-ink shadow-card placeholder:text-ink-3"
      />
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Covered List status">
        {chip("all", "All", items.length)}
        {STATUS_ORDER.map((k) => chip(k, usStatusLabel(k, { short: true }), counts[k]))}
      </div>
      <p className="mt-2 font-mono text-[11px] text-ink-3" role="status">
        {results.length} of {items.length} FCC IDs
        {status !== "all" ? ` · ${usStatusLabel(status, { short: true })}` : ""}
        {q.trim() ? ` · match “${q.trim()}”` : ""}
      </p>

      {results.length === 0 ? (
        <p className="mt-8 rounded-card border border-dashed border-line p-6 text-center text-sm text-ink-2">
          No match. Try the grantee code (Unitree is 2A5PE), part of the model name, or another status.
        </p>
      ) : (
        <ul className="card mt-4 divide-y divide-line-soft px-4">
          {results.map((it) => (
            <li key={it.fcc_id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="font-mono text-[13.5px] font-medium">{it.fcc_id}</div>
                <div className="truncate text-sm text-ink-2">
                  {it.model_id ? (
                    <Link href={`/robots/${it.model_id}`} className="underline decoration-line underline-offset-2 hover:decoration-ink">
                      {it.model_name}
                    </Link>
                  ) : (
                    <span>{it.description ?? "Unlisted device"}</span>
                  )}
                  {it.manufacturer ? ` · ${it.manufacturer}` : it.grantee_code ? ` · grantee ${it.grantee_code}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm">
                <span className="num text-[13px] text-ink-2">{it.grant_date ? fmtDate(it.grant_date) : "Date unknown"}</span>
                <UsStatusBadge kind={it.status} short />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
