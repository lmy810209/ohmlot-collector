"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FccSearchItem } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { Badge } from "./Badge";

export function FccSearch({ items, coveredListDate }: { items: FccSearchItem[]; coveredListDate: string }) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) =>
      [it.fcc_id, it.grantee_code, it.model_name, it.manufacturer, it.description]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(needle)),
    );
  }, [items, q]);

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
        className="h-12 w-full rounded-md border border-zinc-300 bg-white px-4 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-white/10"
      />
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400" role="status">
        {results.length} of {items.length} FCC IDs
        {q.trim() ? ` match “${q.trim()}”` : ""}
      </p>

      {results.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No match. Try the grantee code (Unitree is 2A5PE) or part of the model name.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {results.map((it) => (
            <li key={it.fcc_id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="font-mono text-sm font-medium">{it.fcc_id}</div>
                <div className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                  {it.model_id ? (
                    <Link href={`/robots/${it.model_id}`} className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900 dark:decoration-zinc-600 dark:hover:decoration-white">
                      {it.model_name}
                    </Link>
                  ) : (
                    <span>{it.description ?? "Unlisted device"}</span>
                  )}
                  {it.manufacturer ? ` · ${it.manufacturer}` : it.grantee_code ? ` · grantee ${it.grantee_code}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm">
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {it.grant_date ? fmtDate(it.grant_date) : "Date unknown"}
                </span>
                {it.after_covered_list === true ? (
                  <Badge tone="warn">After {coveredListDate}</Badge>
                ) : it.after_covered_list === false ? (
                  <Badge tone="good">Before {coveredListDate}</Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
