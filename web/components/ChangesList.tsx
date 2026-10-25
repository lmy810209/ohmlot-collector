"use client";

import { useState } from "react";
import { Badge } from "./Badge";
import type { ChangeEventView } from "@/lib/data";
import { EVENT_LABEL, eventTone, eventValueText } from "@/lib/events";
import { fmtDay } from "@/lib/format";

/** One event row. `muted` is task-events-2.md's "shown in gray, not by its usual color" rule for the
 * observation-started section — the row's own event-type color never applies there. */
function ChangeRow({ e, muted }: { e: ChangeEventView; muted: boolean }) {
  // task-prelaunch-2.md §B.2: the variant name was collected but never shown — "40% of /changes looks
  // duplicated" turned out to be two real, distinct variants of the same product with no way to tell them
  // apart on screen. null/empty is skipped, not rendered as "—" or "(unknown)" (never invented).
  const variant = (e.variant ?? "").trim();
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1.5 py-3 text-[13px]" title={muted ? (e.reason ?? undefined) : undefined}>
      <span className="w-14 shrink-0 pt-0.5 font-mono text-[11px] text-ink-3">{fmtDay(e.date)}</span>
      <span className="min-w-[9rem] flex-1">
        <span className="block font-medium text-ink">{e.model_name}</span>
        {variant && <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">{variant}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5">
        <Badge tone={muted ? "muted" : eventTone(e)}>{EVENT_LABEL[e.type]}</Badge>
        <span className={`num truncate ${muted ? "text-ink-3" : "text-ink-2"}`}>{eventValueText(e)}</span>
        <a
          href={e.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[12px] text-accent underline decoration-line underline-offset-2 hover:decoration-accent"
        >
          Source
        </a>
      </span>
    </li>
  );
}

/**
 * task-events-2.md's UI rule, applied here: real events show plainly; observation-started ones stay hidden
 * behind a toggle above the list, shown in gray when expanded — never dropped from the page, just muted.
 * task-changes-page.md §1: an empty real-events list says "No changes yet.", never a count padded out with
 * observation-started rows.
 */
export function ChangesList({ real, observation }: { real: ChangeEventView[]; observation: ChangeEventView[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card p-5 sm:p-6">
      {observation.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mb-4 inline-flex h-8 items-center rounded-full border border-line bg-card px-3 text-[12.5px] font-medium text-ink-2 transition-colors duration-150 hover:bg-sunk"
        >
          {expanded ? "Hide" : "Show"} {observation.length} observation-started event{observation.length === 1 ? "" : "s"}
        </button>
      )}

      {real.length === 0 ? (
        <p className="text-[14px] text-ink-2">No changes yet.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {real.map((e, i) => (
            <ChangeRow key={`${e.date}|${e.model_id}|${e.seller}|${e.variant}|${e.type}|${i}`} e={e} muted={false} />
          ))}
        </ul>
      )}

      {expanded && observation.length > 0 && (
        <div className="mt-5 border-t border-line-soft pt-4">
          <p className="micro mb-1">Observation started — collection began watching this, nothing changed in the world</p>
          <ul className="divide-y divide-line-soft">
            {observation.map((e, i) => (
              <ChangeRow key={`obs|${e.date}|${e.model_id}|${e.seller}|${e.variant}|${e.type}|${i}`} e={e} muted={true} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
