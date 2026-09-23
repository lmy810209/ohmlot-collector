"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FccSearchItem } from "@/lib/data";
import { COVERED_LIST_LABEL, fmtDate } from "@/lib/format";
import { Badge } from "./Badge";

export function FccSearch({ items }: { items: FccSearchItem[] }) {
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
        className="h-12 w-full rounded-md border border-input bg-background px-4 text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
      />
      <p className="mt-2 text-xs text-muted-foreground" role="status">
        {results.length} of {items.length} FCC IDs
        {q.trim() ? ` match “${q.trim()}”` : ""}
      </p>

      {results.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No match. Try the grantee code (Unitree is 2A5PE) or part of the model name.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {results.map((it) => (
            <li key={it.fcc_id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="font-mono text-sm font-medium">{it.fcc_id}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {it.model_id ? (
                    <Link href={`/robots/${it.model_id}`} className="underline decoration-border underline-offset-2 hover:decoration-foreground">
                      {it.model_name}
                    </Link>
                  ) : (
                    <span>{it.description ?? "Unlisted device"}</span>
                  )}
                  {it.manufacturer ? ` · ${it.manufacturer}` : it.grantee_code ? ` · grantee ${it.grantee_code}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm">
                <span className="tabular-nums text-foreground/85">
                  {it.grant_date ? fmtDate(it.grant_date) : "Date unknown"}
                </span>
                {it.after_covered_list === true ? (
                  <Badge tone="warn">After Covered List ({COVERED_LIST_LABEL})</Badge>
                ) : it.after_covered_list === false ? (
                  <Badge tone="good">Before Covered List ({COVERED_LIST_LABEL})</Badge>
                ) : (
                  <Badge>Date unknown</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
