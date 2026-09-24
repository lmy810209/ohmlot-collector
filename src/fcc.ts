import { mkdir, writeFile } from "node:fs/promises";
import notices from "../config/fcc-notices.json" with { type: "json" };
import models from "../data/models.json" with { type: "json" };
import { extractApprovals, type ConditionalApproval, type FccColumn, type NoticeParseStatus } from "./lib/pdf.ts";
import { fetchBinary, readJson, sleep, writeJson } from "./lib/io.ts";

/**
 * FCC Covered List — Conditional Approvals, all three Appendix B columns (UAS, Routers, Robotic Devices).
 *
 * Reads the PSHSB public notices listed in config/fcc-notices.json as PDFs from docs.fcc.gov (the one FCC
 * host reachable from anywhere — apps.fcc.gov and www.fcc.gov are Akamai-blocked, see
 * context/fcc-api-notes.md), keeps each notice's PDF bytes verbatim under data/fcc/raw/, and extracts all
 * three columns of Appendix B with src/lib/pdf.ts's coordinate-based reader (not the docs.fcc.gov .txt
 * rendering, which was proven to merge adjacent table cells — see context/fcc-api-notes.md §8-9 and
 * task-fcc-3.md).
 *
 * task-fcc-4.md §1: all three columns are read, each record tagged with the `fcc_column` FCC itself printed
 * it under — never re-classified by what a device's name sounds like (Ascento, Inc.'s Ascento Guard is a
 * ground security robot, but FCC files it under UAS; the table says nothing reliable about device type).
 * §2: the manufacturer cross-check runs against every record in all three columns, not just Robotic Devices,
 * so "our tracked manufacturers aren't in Appendix B" is actually checked against the whole appendix.
 *
 * Nothing is inferred: a notice whose Appendix B can't be located is "no_appendix" for all three columns; one
 * column whose own header can't be found is "parse_failed" for just that column, and the other two still get
 * read (§1); when no notice could be read at all nothing is written and the run fails. Every extracted record
 * is checked against a small consistency filter (§4) before it's kept; anything that fails it makes the whole
 * run fail loudly rather than silently publish a bad record.
 */

const OUT = "data/fcc/conditional-approvals.json";
const RAW_DIR = "data/fcc/raw";
const pdfUrl = (da: string) => `https://docs.fcc.gov/public/attachments/${da}A1.pdf`;

export interface NoticeStatus {
  da: string;
  released: string;
  url: string;
  fetched: string | null;
  /** "ok" = Appendix B located (regardless of any individual column's own parse_failed — see `columns`).
   * "no_appendix" / "fetch_failed" as before. "parse_failed" here means the PDF itself couldn't be opened at
   * all (pdfjs threw) — a single column's header not being found is recorded per-column in `columns` instead,
   * so the other two columns of an otherwise-readable notice still get published (task-fcc-4.md §1). */
  status: NoticeParseStatus | "fetch_failed";
  /** Per-column result, null when `status` is "fetch_failed" or "parse_failed" (nothing was ever attempted). */
  columns: Record<FccColumn, NoticeParseStatus> | null;
  records: number;
  error: string | null;
}

export interface ApprovalRecord extends ConditionalApproval {
  /** equipment_type | normalised entry | effective_from — stable across notices. */
  id: string;
  /** Notice the row was first read from; later notices that repeat it are listed in also_in. */
  source_da: string;
  source_url: string;
  also_in: string[];
  first_seen: string;
  /** Manufacturer name from data/models.json this record matched, when it does (task-fcc-3.md §5). */
  matched_manufacturer: string | null;
}

export interface ApprovalStore {
  updated: string;
  notices: NoticeStatus[];
  approvals: ApprovalRecord[];
}

const keyOf = (a: ConditionalApproval) => `${a.fcc_column}|${a.entry.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${a.effective_from ?? "?"}`;

/**
 * §4: a record that looks like it's still carrying part of an adjacent cell. None of these should ever fire
 * given src/lib/pdf.ts's column isolation, but they're cheap and this is exactly the class of bug that
 * shipped silently last time (task-fcc-3.md §1-§2) — so a hit here fails the run instead of the data.
 *
 * The "contains a product word" and "implausibly long" checks only apply to the Robotic Devices column.
 * Robotic Devices cells are normally short ("Company X's Model Y, Z robotic platforms"), so a stray product
 * word or a long cell is a real bleed signal there. Routers cells routinely and correctly say
 * "router"/"gateway"/"modem", and routinely run past 300 characters listing many product families (Netgear's,
 * ASUS's, and Arcadyan's real entries all do, verified live) — the same absolute checks would misfire
 * constantly on genuine Routers/UAS content instead of catching anything (task-fcc-4.md §1). The two-"'s"
 * check stays universal: a single cell legitimately naming two different companies' products is rare in any
 * of the three columns, verified against every entry read from the live notices so far.
 */
function suspiciousReasons(a: ConditionalApproval): string[] {
  const reasons: string[] = [];
  const company = a.company ?? "";
  if (/^[\d,]/.test(company.trim())) reasons.push(`company starts with a digit or comma: "${company}"`);
  if (a.fcc_column === "robotic_devices") {
    if (/\b(routers?|series|gateway|modem|repeater|mifi)\b/i.test(company)) reasons.push(`company contains a product word, not a company name: "${company}"`);
    if (a.entry.length > 300) reasons.push(`entry is implausibly long (${a.entry.length} chars) for a Robotic Devices cell: "${a.entry.slice(0, 80)}…"`);
  }
  if (/[’']s\s+.*[’']s\s+/i.test(a.entry)) reasons.push(`entry contains two "'s" possessives — likely two merged cells: "${a.entry}"`);
  return reasons;
}

function matchManufacturer(a: ConditionalApproval): string | null {
  const company = (a.company ?? a.entry).toLowerCase();
  for (const m of models as { manufacturer: string }[]) {
    const maker = m.manufacturer.toLowerCase().replace(/\s*\(.*\)\s*/g, "").trim();
    if (maker.length >= 3 && company.includes(maker)) return m.manufacturer;
  }
  return null;
}

export async function collectFcc(date: string) {
  const prev = await readJson<ApprovalStore>(OUT, { updated: "", notices: [], approvals: [] });
  // task-fcc-4.md §1: fcc_column replaces the old equipment_type field. A record saved before this task has
  // no fcc_column at all, so keyOf() below would give it a different id than the freshly re-extracted version
  // of the very same record — both would be kept, doubling every entry (confirmed live: Husqvarna showed up
  // twice, once under the old id format, once under the new one). Every notice is re-fetched and re-parsed
  // from scratch on every run regardless, so nothing is lost by dropping a stale-schema cached row here — its
  // still-valid replacement is re-added in the same run below, just with first_seen reset to today, which is
  // honest: today genuinely is the first day this record exists under the new column-tagged schema.
  const prevApprovals = prev.approvals.filter((a) => (a as { fcc_column?: unknown }).fcc_column !== undefined);
  const byId = new Map(prevApprovals.map((a) => [a.id, a]));
  const statuses: NoticeStatus[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let readable = 0;

  for (const n of notices) {
    const url = pdfUrl(n.da);
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await fetchBinary(url);
    } catch (e) {
      const error = (e as Error).message;
      statuses.push({ da: n.da, released: n.released, url, fetched: null, status: "fetch_failed", columns: null, records: 0, error });
      errors.push(`${n.da}: ${error}`);
      await sleep(1000);
      continue;
    }
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(`${RAW_DIR}/${n.da}A1.pdf`, pdfBytes); // verbatim, for later re-verification

    let columns: Record<FccColumn, NoticeParseStatus>;
    let approvals: ConditionalApproval[];
    let pageNotes: string[];
    try {
      ({ columns, approvals, pageNotes } = await extractApprovals(pdfBytes));
    } catch (e) {
      const error = (e as Error).message;
      statuses.push({ da: n.da, released: n.released, url, fetched: date, status: "parse_failed", columns: null, records: 0, error });
      errors.push(`${n.da}: ${error}`);
      await sleep(1500);
      continue;
    }
    readable++;
    const overallStatus: NoticeParseStatus = Object.values(columns).every((s) => s === "no_appendix") ? "no_appendix" : "ok";
    for (const [col, colStatus] of Object.entries(columns) as [FccColumn, NoticeParseStatus][]) {
      if (colStatus === "parse_failed") errors.push(`${n.da}: parse_failed for the "${col}" column — its header (or the paired date column's) could not be located`);
    }
    // task-fcc-4.md §3: every page whose column header had to be inherited from an earlier page, logged so a
    // human can spot a layout drift that silently mis-bounded a column rather than cleanly failing it.
    for (const note of pageNotes) errors.push(`${n.da}: ${note}`);

    for (const a of approvals) {
      const flags = suspiciousReasons(a);
      if (flags.length > 0) {
        warnings.push(`${n.da}: suspicious record "${a.entry.slice(0, 60)}…" — ${flags.join("; ")}`);
        continue; // never publish a record that failed the consistency check
      }
      const id = keyOf(a);
      const existing = byId.get(id);
      if (existing) {
        if (existing.source_da !== n.da && !existing.also_in.includes(n.da)) existing.also_in.push(n.da);
      } else {
        byId.set(id, { ...a, id, source_da: n.da, source_url: url, also_in: [], first_seen: date, matched_manufacturer: matchManufacturer(a) });
      }
    }
    statuses.push({ da: n.da, released: n.released, url, fetched: date, status: overallStatus, columns, records: approvals.length, error: null });
    await sleep(1500); // be polite to docs.fcc.gov
  }

  const approvals = [...byId.values()].sort((a, b) => (a.effective_from ?? "").localeCompare(b.effective_from ?? "") || a.entry.localeCompare(b.entry));
  if (readable === 0) return { wrote: false, notices: statuses, approvals, errors, warnings };

  await writeJson(OUT, { updated: date, notices: statuses, approvals } satisfies ApprovalStore);
  // TODO(supabase): mirror `approvals` into a conditional_approvals table once the schema exists.
  return { wrote: true, notices: statuses, approvals, errors, warnings };
}
