import { Badge } from "./Badge";
import type { CollectionStatus } from "@/lib/data";
import { fmtDate, fmtDateTime, STALE_HOURS } from "@/lib/format";

/**
 * task-changes-page.md §2: the daily health check. Every field is exposed as the raw underlying data (guide
 * §6: "모든 화면에 마지막 수집 시각 노출" — never hidden behind a green dot alone), and the whole card turns
 * red once the last collection is more than STALE_HOURS old, since the daily run being silent is exactly
 * the failure mode this card exists to catch.
 */
export function CollectionStatusCard({ status }: { status: CollectionStatus }) {
  return (
    <section
      className={`card p-5 sm:p-6 ${status.isStale ? "ring-1 ring-inset ring-down" : ""}`}
      aria-labelledby="collection-status-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div id="collection-status-heading" className="micro">
          Collection status
        </div>
        {status.isStale ? (
          <Badge tone="down">Collection looks stalled</Badge>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-up">
            <span className="size-2 rounded-full bg-up" aria-hidden="true" />
            healthy
          </span>
        )}
      </div>

      {status.isStale && (
        <p className="mt-3 text-[13.5px] font-medium text-down">
          No new data in over {STALE_HOURS} hours. The daily collector may have stopped running.
        </p>
      )}

      {/* 작업4 §1: GitHub Actions can drop a scheduled run outright under load, not just delay it — a gap
          in the daily record is never swallowed silently into "N daily snapshots" elsewhere on the site. */}
      {status.missingSnapshotDates.length > 0 && (
        <p className="mt-3 text-[13.5px] font-medium text-amber">
          No snapshot on {status.missingSnapshotDates.map((d) => fmtDate(d)).join(", ")} — the daily collector didn&rsquo;t run, or its result never
          committed, on {status.missingSnapshotDates.length === 1 ? "that date" : "those dates"}.
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-[13.5px] sm:grid-cols-4">
        <div>
          <dt className="text-ink-2">Last collection</dt>
          <dd className={`num mt-1 ${status.isStale ? "text-down" : "text-ink"}`}>{status.lastObservedAt ? fmtDateTime(status.lastObservedAt) : "never"}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Today&rsquo;s prices</dt>
          <dd
            className="num mt-1 text-ink"
            title={`Each configured product page is one "source" — a retailer with several product lines counts as several sources. Not the same count as the home page's "stores" (distinct retailers).`}
          >
            {status.todayRows} pts · {status.todaySourcesOk} of {status.totalSources} sources
          </dd>
        </div>
        <div>
          <dt className="text-ink-2">Baseline</dt>
          <dd className="num mt-1 text-ink">{status.baselineComplete ? `Complete · ${status.baselineDay}` : `Day ${status.baselineDay} of ${status.baselineDays}`}</dd>
        </div>
        <div>
          <dt className="text-ink-2">This week</dt>
          <dd className="num mt-1 text-ink">
            {status.weekRealEvents} real event{status.weekRealEvents === 1 ? "" : "s"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
