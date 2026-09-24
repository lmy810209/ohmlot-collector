// Extracts all three columns of a PSHSB public notice PDF's Appendix B: UAS | Routers | Robotic Devices.
//
// Why a PDF parser and not the docs.fcc.gov .txt rendering: Appendix B is a 3-column table, and the .txt
// rendering flattens it to a single stream of running text with no column markers. A regex trying to find
// "company's ..." boundaries in that stream gets it wrong whenever a company name doesn't contain "'s", or
// when two adjacent cells' text runs together — verified on real notices (context/fcc-api-notes.md §8):
// DA-26-996's Askey entry bled into Ascento's, and a phantom "Verizon" entry was fabricated from text that
// was actually still part of Arcadyan's own product list.
//
// This module instead reads the PDF's own text-item coordinates (via pdfjs-dist, the same engine Firefox
// uses) and only looks at the x-range under each column's own header — never at content elsewhere on the
// page. That satisfies task-fcc-3.md §3's rule directly: classification comes from *which column the text
// was printed in*, not from guessing at what a device's name sounds like.
//
// task-fcc-4.md §1: FCC's own column placement doesn't reliably say what a device *is* — Ascento, Inc.'s
// Ascento Guard is a ground security robot, but FCC files it under the UAS column. So all three columns are
// read and tagged with `fcc_column`, the column FCC itself used — this module never re-classifies a device
// by what its name sounds like. Site logic (src/fcc.ts) decides what to do with each column; this module's
// job is only to read the table faithfully, one column pair (entry, dates) at a time.
import { normalizeDate } from "./parse.ts";

// pdfjs-dist ships types for the browser build; the legacy Node build's shape matches at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfJsModule = any;
let pdfjsPromise: Promise<PdfJsModule> | null = null;
function pdfjs(): Promise<PdfJsModule> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsPromise;
}

export type NoticeParseStatus = "ok" | "no_appendix" | "parse_failed";
export type FccColumn = "uas" | "routers" | "robotic_devices";

export interface ConditionalApproval {
  /** Which of the three Appendix B columns FCC itself printed this entry under — a fact about the filing,
   * not a judgment about what the device actually is (task-fcc-4.md §1). */
  fcc_column: FccColumn;
  /** The cell's own text, verbatim (whitespace collapsed). Authoritative — always shown alongside any derived field. */
  entry: string;
  /** Heuristic split of `entry`; null when the split is not obvious. Never used for fcc_column. */
  company: string | null;
  models: string | null;
  effective_from: string | null; // YYYY-MM-DD
  effective_to: string | null; // null = no termination date printed (approval is open-ended)
  /** Extra "Start – End" ranges printed under the same cell (a cell can list more than one date range). */
  extra_dates: { from: string | null; to: string | null }[];
}

export interface Item {
  page: number;
  x: number;
  y: number;
  text: string;
}

const MONTH_NAME = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
const MONTH_DATE = `${MONTH_NAME}\\s+\\d{1,2},\\s+\\d{4}`;
const MONTH_RANGE = new RegExp(`(${MONTH_DATE})\\s*(?:[–—-]\\s*(${MONTH_DATE})?)?`, "g");
const BARE_MONTH_DATE = new RegExp(`^${MONTH_DATE}$`);

// pdfjs groups a whole visual line into one item (e.g. "Robotic Devices", "Dates of"), not one item per word,
// so header noise is filtered by "every word in this item is a header word", not by an exact-string Set.
const HEADER_WORDS = new Set(["Robotic", "Devices", "Conditional", "Approvals", "Dates", "of", "Approval", "Approval*", "Approval#", "#", "UAS", "Routers", "APPENDIX", "B"]);
const DOCKET_WORD = /^(DA|26-\d+)$/;
const isHeaderNoise = (text: string) => text.split(/\s+/).every((w) => HEADER_WORDS.has(w) || DOCKET_WORD.test(w));

/** The three entry-column headers, left to right as FCC prints them. Matched by prefix because pdfjs merges
 * "UAS Conditional" / "Robotic Devices" into one item but leaves "Routers" alone on its own line. */
const COLUMNS: { key: FccColumn; prefix: string }[] = [
  { key: "uas", prefix: "UAS" },
  { key: "routers", prefix: "Routers" },
  { key: "robotic_devices", prefix: "Robotic" },
];

interface ColumnBounds {
  entryX0: number;
  entryHi: number; // = dateX0 of the same column
  dateX0: number;
  dateHi: number; // next column's entryX0, or Infinity for the last column
}
type BoundsByColumn = Partial<Record<FccColumn, ColumnBounds>>;

/**
 * Locates each column's entry/date x-ranges from one page's header-row items. A column whose entry header
 * (or its paired "Dates of … Approval" header, matched by a lone "Approval"/"Approval*"/"Approval#" item —
 * "Approvals", plural, is the *entry* column's own sub-header and must not be confused with it) isn't found
 * on this page is simply absent from the result — not an error. The caller decides what that means: missing
 * on the very first Appendix B page is parse_failed for that column (task-fcc-4.md §1); missing on a later
 * page means "carry the previous page's boundaries forward" (task-fcc-4.md §3).
 *
 * Boundaries are the midpoint between each pair of neighboring header x-positions, not a fixed offset from
 * one header's own x. A fixed offset looks right for Robotic Devices (its multi-word header sits close to
 * its column's true left edge) but is wrong for Routers: verified against the real notices, "Routers" is
 * short enough to print noticeably right of its own column's content — a fixed offset from its header text
 * would clip real entries. The midpoint is self-correcting regardless of how a given header word happens to
 * be aligned within its column.
 */
export function findColumnBounds(headerItems: Item[]): BoundsByColumn {
  const entryHeaders = COLUMNS.map(({ key, prefix }) => ({ key, item: headerItems.find((it) => it.text.startsWith(prefix)) }))
    .filter((h): h is { key: FccColumn; item: Item } => !!h.item)
    .sort((a, b) => a.item.x - b.item.x);
  // "Approval" (singular, + optional "*"/"#" marker) is the *date* column's own sub-header. "Approvals"
  // (plural) is each *entry* column's own sub-header ("UAS Conditional Approvals" etc.) — startsWith alone
  // can't tell them apart, and conflating them pulled a neighboring entry column's own header into this
  // column's date-header search, corrupting the midpoint for every column but the rightmost one.
  const dateCandidates = headerItems.filter((it) => it.text.startsWith("Approval") && !it.text.startsWith("Approvals"));

  const pairs: { key: FccColumn; entryX: number; dateX: number }[] = [];
  for (let i = 0; i < entryHeaders.length; i++) {
    const { key, item } = entryHeaders[i];
    const nextX = i + 1 < entryHeaders.length ? entryHeaders[i + 1].item.x : Infinity;
    const dateHeaders = dateCandidates.filter((it) => it.x > item.x + 20 && it.x < nextX);
    if (dateHeaders.length === 0) continue; // entry header found, but its own date column header wasn't
    pairs.push({ key, entryX: item.x, dateX: Math.max(...dateHeaders.map((it) => it.x)) });
  }

  const out: BoundsByColumn = {};
  for (let i = 0; i < pairs.length; i++) {
    const { key, entryX, dateX } = pairs[i];
    const entryX0 = i > 0 ? (pairs[i - 1].dateX + entryX) / 2 : -Infinity;
    const dateX0 = (entryX + dateX) / 2;
    const dateHi = i + 1 < pairs.length ? (dateX + pairs[i + 1].entryX) / 2 : Infinity;
    out[key] = { entryX0, entryHi: dateX0, dateX0, dateHi };
  }
  return out;
}

function splitEntry(entry: string): { company: string | null; models: string | null } {
  const poss = entry.match(/^(.+?)[’']s\s+(.+)$/);
  if (poss) return { company: poss[1].trim(), models: poss[2].replace(/\s*robotic (?:platforms?|devices?)\s*$/i, "").trim() || null };
  const tokens = entry.split(" ");
  const i = tokens.findIndex((t) => /\d/.test(t));
  if (i > 0) {
    return { company: tokens.slice(0, i).join(" "), models: tokens.slice(i).join(" ").replace(/\s*robotic (?:platforms?|devices?)\s*$/i, "").trim() || null };
  }
  return { company: entry, models: null };
}

/**
 * Reads every text item on a page via pdfjs's getTextContent, tagged with its page index and PDF-space (x, y).
 * A pdfjs "item" is usually a whole visual line within one column (verified against the fixtures), which is
 * exactly the granularity this needs: line-by-line, left-to-right within a row.
 */
async function pageItems(page: PdfJsModule, pageIndex: number): Promise<Item[]> {
  const tc = await page.getTextContent();
  const out: Item[] = [];
  for (const it of tc.items as { str?: string; transform?: number[] }[]) {
    const text = (it.str ?? "").trim();
    if (!text || !it.transform) continue;
    out.push({ page: pageIndex, x: it.transform[4], y: it.transform[5], text });
  }
  return out;
}

const rank = (it: Item) => it.page * 1e7 - it.y; // earlier page first; within a page, PDF y grows upward, so top-of-page sorts first

/** A "Start – End" range is often printed as two lines — "April 14, 2026 –" then "October 1, 2027" — which
 * pdfjs hands back as two separate items. Read independently, the second line ("October 1, 2027" alone) also
 * matches MONTH_RANGE on its own and would be miscounted as a second, unrelated marker, fragmenting the one
 * record after it into pieces (confirmed against DA-26-957's Routers column, which — unlike the Robotic
 * Devices column in the original fixtures — has several genuinely open-ended AND several two-line ranges).
 * Merges an item ending in a dash into the very next item only when that next item is *purely* a trailing
 * date (nothing else on the line) — never a coincidental date-shaped string that's actually the start of an
 * unrelated next entry. */
function mergeDateContinuations(items: Item[]): Item[] {
  const out: Item[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const next = items[i + 1];
    if (next && next.page === it.page && /[–—-]\s*$/.test(it.text) && BARE_MONTH_DATE.test(next.text)) {
      out.push({ ...it, text: `${it.text} ${next.text}` });
      i++; // consumed as part of this marker, not its own
    } else {
      out.push(it);
    }
  }
  return out;
}

/** Runs the marker-based record extraction (task-fcc-3.md's algorithm) for one column's accumulated entry
 * and date items. Every "Month D, YYYY [– Month D, YYYY]" found in the date column marks the *start* of one
 * record: the FCC prints each entry's date on the same row as that entry's own first line, so a record's
 * full text is every entry-column row from its own date's row down to (but not including) the next date's
 * row — never "whatever text happened to come right before a date". */
function extractColumnRecords(column: FccColumn, entryItems: Item[], dateItems: Item[]): ConditionalApproval[] {
  const sortedEntries = entryItems.slice().sort((a, b) => rank(a) - rank(b));
  const sortedDates = mergeDateContinuations(dateItems.slice().sort((a, b) => rank(a) - rank(b)));
  const markers: { rank: number; from: string | null; to: string | null }[] = [];
  for (const it of sortedDates) {
    for (const m of it.text.matchAll(MONTH_RANGE)) markers.push({ rank: rank(it), from: normalizeDate(m[1]), to: m[2] ? normalizeDate(m[2]) : null });
  }
  markers.sort((a, b) => a.rank - b.rank);

  const approvals: ConditionalApproval[] = [];
  for (let i = 0; i < markers.length; i++) {
    const lo = markers[i].rank;
    const hi = i + 1 < markers.length ? markers[i + 1].rank : Infinity;
    const lines = sortedEntries.filter((it) => rank(it) >= lo && rank(it) < hi).map((it) => it.text);
    const entry = lines.join(" ").replace(/\s+/g, " ").trim();
    if (!entry) continue; // a date with no entry text under it — drop rather than invent a record
    approvals.push({ fcc_column: column, entry, ...splitEntry(entry), effective_from: markers[i].from, effective_to: markers[i].to, extra_dates: [] });
  }
  return approvals;
}

/**
 * Parses all three Appendix B columns of a PSHSB Conditional Approvals notice PDF. Returns a per-column
 * status: "no_appendix" when the notice has no Appendix B at all (most notices don't — only ones announcing
 * new approvals do; this applies to all three columns uniformly), "parse_failed" for a column whose header
 * can't be located even on the first appendix page (format changed for that column specifically — the other
 * two still get read, task-fcc-4.md §1), and "ok" otherwise. Never guesses a record from a page it couldn't
 * confidently read. `pageNotes` records every page where a column's boundaries had to be inherited from an
 * earlier page because that page printed no header row of its own (task-fcc-4.md §3).
 */
export async function extractApprovals(
  pdfBytes: Uint8Array,
): Promise<{ columns: Record<FccColumn, NoticeParseStatus>; approvals: ConditionalApproval[]; pageNotes: string[] }> {
  const { getDocument } = await pdfjs();
  let doc: PdfJsModule;
  try {
    // verbosity: 0 silences pdfjs's own console warnings (e.g. "TT: undefined function") for a font-hinting
    // quirk in these PDFs that doesn't affect the extracted text — confirmed by the exact-match fixture tests.
    doc = await getDocument({ data: pdfBytes, isEvalSupported: false, useSystemFonts: true, verbosity: 0 }).promise;
  } catch (e) {
    throw new Error(`could not open PDF: ${(e as Error).message}`);
  }

  const noAppendix: Record<FccColumn, NoticeParseStatus> = { uas: "no_appendix", routers: "no_appendix", robotic_devices: "no_appendix" };

  // Find the Appendix B page range: starts where "APPENDIX B" appears, ends on the page carrying the
  // "*Consistent with the National Security Determination…" footnote (present on every notice that has an
  // Appendix B at all, per the four notices this was built and checked against).
  let startPage = -1;
  let endPage = -1;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const text = (tc.items as { str?: string }[]).map((it) => it.str ?? "").join(" ");
    // Some notices have an "APPENDIX B" that isn't the Conditional Approvals table at all (DA-26-786's is a
    // National Security Determination). Require the table's own subtitle right after it, on the same page.
    if (startPage < 0 && /APPENDIX\s+B[\s\S]{0,80}Conditional Approvals/.test(text)) startPage = p;
    if (startPage >= 0 && /Consistent with the National Security/.test(text)) {
      endPage = p;
      break;
    }
  }
  if (startPage < 0) return { columns: noAppendix, approvals: [], pageNotes: [] };
  if (endPage < 0) endPage = Math.min(startPage + 4, doc.numPages); // defensive cap if the footnote text ever changes

  // The footnote paragraph shares the last appendix page with real table rows; cut it off by y-position so
  // its prose text (which can contain "…September 2026…"-shaped substrings, or just run on into whatever
  // entry happens to be nearest it) never leaks into the table. footnoteY is the y of the footnote's own
  // *first* line (its "*Consistent with the…" marker) — table rows sit ABOVE it on the page (larger y, PDF y
  // grows upward), and the footnote's own continuation lines sit AT OR BELOW it (smaller y), so the cutoff
  // excludes y <= footnoteY, not y >= footnoteY (confirmed against DA-26-957's real footnote: its own second
  // line, "reflect a termination date…", has a *smaller* y than its first line and was leaking into whatever
  // entry preceded it under the old >= comparison — verified via Parallel Flight Technologies' UAS entry
  // picking up that exact sentence).
  // Defaults to -Infinity (cut nothing), not +Infinity (cut everything) — DA-26-996's own "Consistent with
  // the National Security…" text turned out to live on page 2 (elsewhere in the notice, not Appendix B's own
  // footnote), so its fallback endPage (the page-count cap below) legitimately has no footnote text on it at
  // all; with the *correct* comparison direction, a "not found" default of +Infinity would wrongly exclude
  // the entire page (y <= +Infinity is always true) — including Ascento, Inc.'s real UAS entry there. This
  // only mattered once reading reached that page (the Robotic Devices column here never had to, so neither
  // direction bug was exercised until task-fcc-4.md §1 added the other two).
  let footnoteY = -Infinity;
  {
    const lastPage = await doc.getPage(endPage);
    for (const it of await pageItems(lastPage, endPage)) {
      if (it.text.includes("Consistent")) footnoteY = Math.max(footnoteY, it.y);
    }
  }

  const entryItemsByColumn: Record<FccColumn, Item[]> = { uas: [], routers: [], robotic_devices: [] };
  const dateItemsByColumn: Record<FccColumn, Item[]> = { uas: [], routers: [], robotic_devices: [] };
  const columns: Record<FccColumn, NoticeParseStatus> = { uas: "ok", routers: "ok", robotic_devices: "ok" };
  const pageNotes: string[] = [];
  let currentBounds: BoundsByColumn = {};

  for (let p = startPage; p <= endPage; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const items = await pageItems(page, p);
    // Column boundaries come from the header row itself — never a hardcoded pixel value — so a shifted page
    // layout in a future notice still resolves correctly as long as the header text is still there. Only the
    // top of the page can plausibly hold the header row.
    const found = findColumnBounds(items.filter((it) => it.y > viewport.height - 200));

    if (p === startPage) {
      currentBounds = found;
      for (const { key } of COLUMNS) if (!currentBounds[key]) columns[key] = "parse_failed";
    } else if (Object.keys(found).length > 0) {
      currentBounds = { ...currentBounds, ...found }; // re-detected on this page — no note needed, this is the expected case
    } else {
      pageNotes.push(`page ${p}: no column header found on this page — inherited boundaries from a previous page`);
    }

    for (const it of items) {
      if (p === endPage && it.y <= footnoteY + 2) continue; // footnote paragraph (its first line, and everything below it)
      if (it.y > viewport.height - 50 || it.y < 45) continue; // running header/footer band
      if (isHeaderNoise(it.text)) continue;
      for (const { key } of COLUMNS) {
        if (columns[key] === "parse_failed") continue; // never bounded on startPage — nothing to collect into
        const b = currentBounds[key];
        if (!b) continue;
        if (it.x >= b.entryX0 && it.x < b.entryHi) {
          entryItemsByColumn[key].push(it);
          break;
        }
        if (it.x >= b.dateX0 && it.x < b.dateHi) {
          dateItemsByColumn[key].push(it);
          break;
        }
      }
    }
  }

  const approvals: ConditionalApproval[] = [];
  for (const { key } of COLUMNS) {
    if (columns[key] === "parse_failed") continue;
    const records = extractColumnRecords(key, entryItemsByColumn[key], dateItemsByColumn[key]);
    if (records.length === 0 && entryItemsByColumn[key].length === 0 && dateItemsByColumn[key].length === 0) {
      columns[key] = "parse_failed"; // header found, but genuinely no content followed it
      continue;
    }
    approvals.push(...records);
  }

  return { columns, approvals, pageNotes };
}
