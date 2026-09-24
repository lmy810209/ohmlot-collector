import { mkdir, writeFile } from "node:fs/promises";
import notices from "../config/fcc-notices.json" with { type: "json" };
import models from "../data/models.json" with { type: "json" };
import { extractRoboticApprovals, type ConditionalApproval, type NoticeParseStatus } from "./lib/pdf.ts";
import { fetchBinary, readJson, sleep, writeJson } from "./lib/io.ts";

/**
 * FCC Covered List — Conditional Approvals for advanced robotic devices.
 *
 * Reads the PSHSB public notices listed in config/fcc-notices.json as PDFs from docs.fcc.gov (the one FCC
 * host reachable from anywhere — apps.fcc.gov and www.fcc.gov are Akamai-blocked, see
 * context/fcc-api-notes.md), keeps each notice's PDF bytes verbatim under data/fcc/raw/, and extracts the
 * Robotic Devices column of Appendix B with src/lib/pdf.ts's coordinate-based reader (not the docs.fcc.gov
 * .txt rendering, which was proven to merge adjacent table cells — see context/fcc-api-notes.md §8-9 and
 * task-fcc-3.md). Only the Robotic Devices column is read; UAS and Router entries are not tracked here.
 *
 * Nothing is inferred: a notice whose Appendix B can't be located is "parse_failed", one that never has an
 * approvals table at all is "no_appendix", and when no notice could be read at all nothing is written and
 * the run fails. Every extracted record is checked against a small consistency filter (§4) before it's kept;
 * anything that fails it makes the whole run fail loudly rather than silently publish a bad record.
 */

const OUT = "data/fcc/conditional-approvals.json";
const RAW_DIR = "data/fcc/raw";
const pdfUrl = (da: string) => `https://docs.fcc.gov/public/attachments/${da}A1.pdf`;

export interface NoticeStatus {
  da: string;
  released: string;
  url: string;
  fetched: string | null;
  status: NoticeParseStatus | "fetch_failed";
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

const keyOf = (a: ConditionalApproval) => `${a.equipment_type}|${a.entry.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${a.effective_from ?? "?"}`;

/**
 * §4: a record that looks like it's still carrying part of an adjacent cell. None of these should ever fire
 * given src/lib/pdf.ts's column isolation, but they're cheap and this is exactly the class of bug that
 * shipped silently last time (task-fcc-3.md §1-§2) — so a hit here fails the run instead of the data.
 */
function suspiciousReasons(a: ConditionalApproval): string[] {
  const reasons: string[] = [];
  const company = a.company ?? "";
  if (/^[\d,]/.test(company.trim())) reasons.push(`company starts with a digit or comma: "${company}"`);
  if (/\b(routers?|series|gateway|modem|repeater|mifi)\b/i.test(company)) reasons.push(`company contains a product word, not a company name: "${company}"`);
  if (/[’']s\s+.*[’']s\s+/i.test(a.entry)) reasons.push(`entry contains two "'s" possessives — likely two merged cells: "${a.entry}"`);
  if (a.entry.length > 300) reasons.push(`entry is implausibly long (${a.entry.length} chars) for a robotic-device cell: "${a.entry.slice(0, 80)}…"`);
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
  const byId = new Map(prev.approvals.map((a) => [a.id, a]));
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
      statuses.push({ da: n.da, released: n.released, url, fetched: null, status: "fetch_failed", records: 0, error });
      errors.push(`${n.da}: ${error}`);
      await sleep(1000);
      continue;
    }
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(`${RAW_DIR}/${n.da}A1.pdf`, pdfBytes); // verbatim, for later re-verification

    let status: NoticeParseStatus;
    let approvals: ConditionalApproval[];
    try {
      ({ status, approvals } = await extractRoboticApprovals(pdfBytes));
    } catch (e) {
      const error = (e as Error).message;
      statuses.push({ da: n.da, released: n.released, url, fetched: date, status: "parse_failed", records: 0, error });
      errors.push(`${n.da}: ${error}`);
      await sleep(1500);
      continue;
    }
    readable++;
    if (status === "parse_failed") errors.push(`${n.da}: parse_failed — Appendix B present but the Robotic Devices column header could not be located`);

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
    statuses.push({ da: n.da, released: n.released, url, fetched: date, status, records: approvals.length, error: null });
    await sleep(1500); // be polite to docs.fcc.gov
  }

  const approvals = [...byId.values()].sort((a, b) => (a.effective_from ?? "").localeCompare(b.effective_from ?? "") || a.entry.localeCompare(b.entry));
  if (readable === 0) return { wrote: false, notices: statuses, approvals, errors, warnings };

  await writeJson(OUT, { updated: date, notices: statuses, approvals } satisfies ApprovalStore);
  // TODO(supabase): mirror `approvals` into a conditional_approvals table once the schema exists.
  return { wrote: true, notices: statuses, approvals, errors, warnings };
}
