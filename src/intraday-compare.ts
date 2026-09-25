// task-measure.md §B's 판정: after real time has passed and intraday snapshots have accumulated, run this
// (`npm run intraday:compare`) to answer "what would daily-only have missed?" — compares every real
// consecutive 6-hourly pair against a simulated once-a-day observer (the snapshot nearest 00:17 UTC each
// day, since that's when the actual daily canonical collector runs). Never invents data: with fewer than 2
// intraday snapshots on file, it says so and reports nothing.
import { readdir } from "node:fs/promises";
import { generateEvents } from "./events.ts";
import { readJsonl } from "./lib/io.ts";
import type { PriceRow } from "./lib/parse.ts";

const INTRADAY_DIR = "data/prices/intraday";
const DAILY_TARGET_HHMM = 17; // 00:17 UTC, matching .github/workflows/daily.yml's cron

export interface IntradaySnapshot {
  date: string;
  hhmm: string;
  rows: PriceRow[];
}

export async function loadAllIntradaySnapshots(dir = INTRADAY_DIR): Promise<IntradaySnapshot[]> {
  let dates: string[];
  try {
    dates = (await readdir(dir)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  } catch {
    return [];
  }
  const out: IntradaySnapshot[] = [];
  for (const date of dates) {
    let files: string[];
    try {
      files = (await readdir(`${dir}/${date}`)).filter((f) => /^\d{4}\.jsonl$/.test(f)).sort();
    } catch {
      continue;
    }
    for (const f of files) {
      const hhmm = f.slice(0, 4);
      out.push({ date, hhmm, rows: await readJsonl<PriceRow>(`${dir}/${date}/${f}`) });
    }
  }
  return out.sort((a, b) => (a.date + a.hhmm).localeCompare(b.date + b.hhmm));
}

export interface IntradayComparison {
  snapshotsFound: number;
  /** Real (non-observation) events found by diffing every consecutive 6-hourly pair. */
  allEvents: number;
  /** Events a once-a-day observer (only the snapshot nearest 00:17 UTC each day) would have found. */
  dailyOnlyEvents: number;
  missedCount: number;
  /** Null when allEvents is 0 — a percentage of zero is not "0% missed", it's "nothing to measure yet". */
  missedPct: number | null;
  note: string | null;
}

/** Pure — takes already-loaded snapshots, so it's testable without touching the filesystem. */
export function compareFrequency(all: IntradaySnapshot[]): IntradayComparison {
  if (all.length < 2) {
    return {
      snapshotsFound: all.length,
      allEvents: 0,
      dailyOnlyEvents: 0,
      missedCount: 0,
      missedPct: null,
      note: "Fewer than 2 intraday snapshots exist yet — nothing to compare. task-measure.md §B needs real time to pass (2 weeks); this isn't simulated.",
    };
  }

  let allEvents = 0;
  for (let i = 1; i < all.length; i++) {
    allEvents += generateEvents(all[i - 1].rows, all[i].rows, all[i].date, []).filter((e) => !e.observation_change).length;
  }

  // Simulate "daily-only": keep just the snapshot nearest 00:17 UTC per date (ties go to the earlier one).
  const byDate = new Map<string, IntradaySnapshot>();
  for (const s of all) {
    const dist = Math.abs(parseInt(s.hhmm, 10) - DAILY_TARGET_HHMM);
    const cur = byDate.get(s.date);
    if (!cur || dist < Math.abs(parseInt(cur.hhmm, 10) - DAILY_TARGET_HHMM)) byDate.set(s.date, s);
  }
  const dailyOnly = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  let dailyOnlyEvents = 0;
  for (let i = 1; i < dailyOnly.length; i++) {
    dailyOnlyEvents += generateEvents(dailyOnly[i - 1].rows, dailyOnly[i].rows, dailyOnly[i].date, []).filter((e) => !e.observation_change).length;
  }

  const missedCount = Math.max(0, allEvents - dailyOnlyEvents);
  return {
    snapshotsFound: all.length,
    allEvents,
    dailyOnlyEvents,
    missedCount,
    missedPct: allEvents > 0 ? (missedCount / allEvents) * 100 : 0,
    note: null,
  };
}

async function main() {
  const all = await loadAllIntradaySnapshots();
  const r = compareFrequency(all);
  console.log(`[intraday-compare] ${r.snapshotsFound} intraday snapshots on file`);
  if (r.note) {
    console.log(`  ${r.note}`);
    return;
  }
  console.log(`  6-hourly observation found: ${r.allEvents} real events`);
  console.log(`  A once-a-day (00:17 UTC) observer would have found: ${r.dailyOnlyEvents} real events`);
  console.log(`  Missed by going daily-only: ${r.missedCount} events (${r.missedPct?.toFixed(1)}%)`);
}

// Only run as a script, not when imported by the test suite.
if (process.argv[1]?.endsWith("intraday-compare.ts")) await main();
