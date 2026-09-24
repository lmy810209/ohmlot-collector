import Link from "next/link";
import { Badge } from "./Badge";
import type { ChangeEventView } from "@/lib/data";
import { EVENT_LABEL, eventTone, eventValueText } from "@/lib/events";
import { fmtDay } from "@/lib/format";

/**
 * task-changes-page.md §3: the home page's latest 3 real events, linking to /changes. Renders nothing at all
 * when there are no real events yet — no empty-state card. Guide §6's "빈칸 금지" (never leave a blank) is
 * about a labeled fact that would otherwise go missing (e.g. an untracked robot's price), not license to
 * invent a card whose only content is "nothing happened yet".
 */
export function RecentChanges({ events }: { events: ChangeEventView[] }) {
  if (events.length === 0) return null;
  const top = events.slice(0, 3);
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="recent-changes-heading">
      <div className="flex items-center justify-between gap-3">
        <div id="recent-changes-heading" className="micro">
          Recent changes
        </div>
        <Link href="/changes" className="text-[12.5px] font-medium text-accent hover:underline">
          View all
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-line-soft text-[13px]">
        {top.map((e, i) => (
          <li key={`${e.date}|${e.model_id}|${e.seller}|${e.variant}|${e.type}|${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="w-14 shrink-0 font-mono text-[11px] text-ink-3">{fmtDay(e.date)}</span>
            <span className="min-w-[9rem] flex-1 font-medium text-ink">{e.model_name}</span>
            <Badge tone={eventTone(e)}>{EVENT_LABEL[e.type]}</Badge>
            <span className="num truncate text-ink-2">{eventValueText(e)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
