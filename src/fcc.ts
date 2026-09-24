import { mkdir, writeFile } from "node:fs/promises";
import notices from "../config/fcc-notices.json" with { type: "json" };
import { parseConditionalApprovals, type ConditionalApproval, type NoticeParseStatus } from "./lib/parse.ts";
import { fetchText, readJson, sleep, writeJson } from "./lib/io.ts";

/**
 * FCC Covered List — Conditional Approvals for advanced robotic devices.
 *
 * Reads the PSHSB public notices listed in config/fcc-notices.json from docs.fcc.gov (the one FCC host that is
 * reachable from GitHub runners and elsewhere; apps.fcc.gov and www.fcc.gov are Akamai-blocked, see
 * context/fcc-api-notes.md), keeps each notice's .txt verbatim under data/fcc/raw/, and accumulates the parsed
 * Appendix B rows in data/fcc/conditional-approvals.json. FCC documents are the only source stored here.
 *
 * Nothing is inferred: a notice whose appendix cannot be parsed is recorded as parse_failed, and when no notice
 * could be read at all nothing is written and the run fails.
 */

const OUT = "data/fcc/conditional-approvals.json";
const RAW_DIR = "data/fcc/raw";
const txtUrl = (da: string) => `https://docs.fcc.gov/public/attachments/${da}A1.txt`;
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
}

export interface ApprovalStore {
  updated: string;
  notices: NoticeStatus[];
  approvals: ApprovalRecord[];
}

const keyOf = (a: ConditionalApproval) => `${a.equipment_type}|${a.entry.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${a.effective_from ?? "?"}`;

export async function collectFcc(date: string) {
  const prev = await readJson<ApprovalStore>(OUT, { updated: "", notices: [], approvals: [] });
  const byId = new Map(prev.approvals.map((a) => [a.id, a]));
  const statuses: NoticeStatus[] = [];
  const errors: string[] = [];
  let readable = 0;

  for (const n of notices) {
    const url = txtUrl(n.da);
    let text: string;
    try {
      text = await fetchText(url);
    } catch (e) {
      const error = (e as Error).message;
      statuses.push({ da: n.da, released: n.released, url, fetched: null, status: "fetch_failed", records: 0, error });
      errors.push(`${n.da}: ${error}`);
      await sleep(1000);
      continue;
    }
    readable++;
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(`${RAW_DIR}/${n.da}A1.txt`, text); // verbatim, for later verification

    const { status, approvals } = parseConditionalApprovals(text);
    if (status === "parse_failed") errors.push(`${n.da}: parse_failed — appendix present but no rows could be read`);
    for (const a of approvals) {
      const id = keyOf(a);
      const existing = byId.get(id);
      if (existing) {
        if (existing.source_da !== n.da && !existing.also_in.includes(n.da)) existing.also_in.push(n.da);
      } else {
        byId.set(id, { ...a, id, source_da: n.da, source_url: pdfUrl(n.da), also_in: [], first_seen: date });
      }
    }
    statuses.push({ da: n.da, released: n.released, url, fetched: date, status, records: approvals.length, error: null });
    await sleep(1500); // be polite to docs.fcc.gov
  }

  const approvals = [...byId.values()].sort((a, b) => (a.effective_from ?? "").localeCompare(b.effective_from ?? "") || a.entry.localeCompare(b.entry));
  if (readable === 0) return { wrote: false, notices: statuses, approvals, errors };

  await writeJson(OUT, { updated: date, notices: statuses, approvals } satisfies ApprovalStore);
  // TODO(supabase): mirror `approvals` into a conditional_approvals table once the schema exists.
  return { wrote: true, notices: statuses, approvals, errors };
}
