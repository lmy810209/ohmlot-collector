// Extracts the "Robotic Devices Conditional Approvals" column from a PSHSB public notice PDF's Appendix B.
//
// Why a PDF parser and not the docs.fcc.gov .txt rendering: Appendix B is a 3-column table (UAS | Routers |
// Robotic Devices), and the .txt rendering flattens it to a single stream of running text with no column
// markers. A regex trying to find "company's ..." boundaries in that stream gets it wrong whenever a company
// name doesn't contain "'s", or when two adjacent cells' text runs together — verified on real notices
// (context/fcc-api-notes.md §8): DA-26-996's Askey entry bled into Ascento's, and a phantom "Verizon" entry
// was fabricated from text that was actually still part of Arcadyan's own product list.
//
// This module instead reads the PDF's own text-item coordinates (via pdfjs-dist, the same engine Firefox
// uses) and only looks at the x-range under the "Robotic Devices" column header — never at content elsewhere
// on the page. That satisfies task-fcc-3.md §3's rule directly: classification comes from *which column the
// text was printed in*, not from guessing at what a device's name sounds like. UAS and Router entries are not
// extracted at all: this site tracks personal robots, and those columns' cells are long multi-line lists of
// unrelated products (see the Calix/Sagemcom rows in the fixtures) that would need the same kind of table
// understanding to get right for no benefit to Ohmlot.
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

export interface ConditionalApproval {
  equipment_type: "robotic_device";
  /** The Robotic Devices cell, verbatim (whitespace collapsed). Authoritative — always shown alongside any derived field. */
  entry: string;
  /** Heuristic split of `entry`; null when the split is not obvious. Never used for equipment_type. */
  company: string | null;
  models: string | null;
  effective_from: string | null; // YYYY-MM-DD
  effective_to: string | null; // null = no termination date printed (approval is open-ended)
  /** Extra "Start – End" ranges printed under the same cell (a cell can list more than one date range). */
  extra_dates: { from: string | null; to: string | null }[];
}

interface Item {
  page: number;
  x: number;
  y: number;
  text: string;
}

const MONTH_RANGE = /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\s*(?:[–—-]\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})?)?/g;

// pdfjs groups a whole visual line into one item (e.g. "Robotic Devices", "Dates of"), not one item per word,
// so header noise is filtered by "every word in this item is a header word", not by an exact-string Set.
const HEADER_WORDS = new Set(["Robotic", "Devices", "Conditional", "Approvals", "Dates", "of", "Approval", "Approval*", "Approval#", "#", "UAS", "Routers", "APPENDIX", "B"]);
const DOCKET_WORD = /^(DA|26-\d+)$/;
const isHeaderNoise = (text: string) => text.split(/\s+/).every((w) => HEADER_WORDS.has(w) || DOCKET_WORD.test(w));

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

/**
 * Parses the Robotic Devices column of a PSHSB Conditional Approvals notice PDF. Returns "no_appendix" when
 * the notice has no Appendix B (most notices don't — only ones announcing new approvals do), "parse_failed"
 * when an appendix exists but the Robotic Devices column header can't be located (format changed), and never
 * guesses a record from a page it couldn't confidently read.
 */
export async function extractRoboticApprovals(pdfBytes: Uint8Array): Promise<{ status: NoticeParseStatus; approvals: ConditionalApproval[] }> {
  const { getDocument } = await pdfjs();
  let doc: PdfJsModule;
  try {
    // verbosity: 0 silences pdfjs's own console warnings (e.g. "TT: undefined function") for a font-hinting
    // quirk in these PDFs that doesn't affect the extracted text — confirmed by the exact-match fixture tests.
    doc = await getDocument({ data: pdfBytes, isEvalSupported: false, useSystemFonts: true, verbosity: 0 }).promise;
  } catch (e) {
    throw new Error(`could not open PDF: ${(e as Error).message}`);
  }

  // Find the Appendix B page range: starts where "APPENDIX B" appears, ends on the page carrying the
  // "*Consistent with the National Security Determination…" footnote (present on every notice that has an
  // Appendix B at all, per the four notices this was built and checked against).
  let startPage = -1;
  let endPage = -1;
  const pageTexts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const text = (tc.items as { str?: string }[]).map((it) => it.str ?? "").join(" ");
    pageTexts[p] = text;
    // Some notices have an "APPENDIX B" that isn't the Conditional Approvals table at all (DA-26-786's is a
    // National Security Determination). Require the table's own subtitle right after it, on the same page.
    if (startPage < 0 && /APPENDIX\s+B[\s\S]{0,80}Conditional Approvals/.test(text)) startPage = p;
    if (startPage >= 0 && /Consistent with the National Security/.test(text)) {
      endPage = p;
      break;
    }
  }
  if (startPage < 0) return { status: "no_appendix", approvals: [] };
  if (endPage < 0) endPage = Math.min(startPage + 4, doc.numPages); // defensive cap if the footnote text ever changes

  // Column boundaries come from the header row itself on the first appendix page — never a hardcoded pixel
  // value — so a shifted page layout in a future notice still resolves correctly as long as the header text
  // ("Robotic Devices" / "Dates of … Approval") is still there.
  const headerPage = await doc.getPage(startPage);
  const headerItems = await pageItems(headerPage, startPage);
  const roboticHeader = headerItems.find((it) => it.text.startsWith("Robotic"));
  if (!roboticHeader) return { status: "parse_failed", approvals: [] };
  const dateHeaders = headerItems.filter((it) => it.text.startsWith("Approval") && it.x > roboticHeader.x + 20);
  if (dateHeaders.length === 0) return { status: "parse_failed", approvals: [] };
  const entryX0 = roboticHeader.x - 15;
  const dateX0 = Math.max(...dateHeaders.map((it) => it.x)) - 25;

  // The footnote paragraph shares the last appendix page with real table rows; cut it off by y-position so
  // its prose text (which can contain "…September 2026…"-shaped substrings) never leaks into the table.
  let footnoteY = -Infinity;
  {
    const lastPage = await doc.getPage(endPage);
    for (const it of await pageItems(lastPage, endPage)) {
      if (it.text.includes("Consistent")) footnoteY = Math.max(footnoteY, it.y);
    }
  }

  const entryItems: Item[] = [];
  const dateItems: Item[] = [];
  for (let p = startPage; p <= endPage; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    for (const it of await pageItems(page, p)) {
      if (p === endPage && it.y >= footnoteY - 2) continue; // footnote paragraph
      if (it.y > viewport.height - 50 || it.y < 45) continue; // running header/footer band
      if (isHeaderNoise(it.text)) continue;
      if (it.x >= entryX0 && it.x < dateX0) entryItems.push(it);
      else if (it.x >= dateX0) dateItems.push(it);
    }
  }
  // Reading order: earlier page first; within a page, PDF y grows upward, so top-of-page sorts first (descending y).
  const rank = (it: Item) => it.page * 1e7 - it.y;
  entryItems.sort((a, b) => rank(a) - rank(b));
  dateItems.sort((a, b) => rank(a) - rank(b));

  // Every "Month D, YYYY [– Month D, YYYY]" found in the date column marks the *start* of one record: the FCC
  // prints each entry's date on the same row as that entry's own first line (verified against both fixtures —
  // "Husqvarna AB 305v" and "September 9, 2026 –" share one row; "ANSCER Robotics" and "September 18, 2026"
  // share the next one, many rows lower). So a record's full text is every entry-column row from its own date's
  // row down to (but not including) the next date's row — never "whatever text happened to come right before
  // a date", which is what broke the old regex parser when a company's own product list ran to several lines.
  const markers: { rank: number; from: string | null; to: string | null }[] = [];
  for (const it of dateItems) {
    for (const m of it.text.matchAll(MONTH_RANGE)) {
      markers.push({ rank: rank(it), from: normalizeDate(m[1]), to: m[2] ? normalizeDate(m[2]) : null });
    }
  }
  markers.sort((a, b) => a.rank - b.rank);

  const approvals: ConditionalApproval[] = [];
  for (let i = 0; i < markers.length; i++) {
    const lo = markers[i].rank;
    const hi = i + 1 < markers.length ? markers[i + 1].rank : Infinity;
    const lines = entryItems.filter((it) => rank(it) >= lo && rank(it) < hi).map((it) => it.text);
    const entry = lines.join(" ").replace(/\s+/g, " ").trim();
    if (!entry) continue; // a date with no entry text under it — drop rather than invent a record
    approvals.push({ equipment_type: "robotic_device", entry, ...splitEntry(entry), effective_from: markers[i].from, effective_to: markers[i].to, extra_dates: [] });
  }

  if (approvals.length === 0 && entryItems.length === 0 && dateItems.length === 0) return { status: "parse_failed", approvals: [] };
  return { status: "ok", approvals };
}
