// Search-facing titles and descriptions, built from the same data the pages render so a snippet never
// says something the page doesn't. Build-time only (reads ../data through lib/data.ts).
import { getApprovalStore, getModels, lastUpdated, latestPrices, modelUsStatus, trackedRange, usStatusKind, type Category, type Model } from "./data";
import { COVERED_LIST_LABEL, fmtDate, purchaseRange, rangeText, subscriptionLabel } from "./format";
import { SITE_NAME, SITE_URL } from "./site";

/** Search results cut a description at roughly this many characters, a title at roughly 60 (suffix included). */
export const MAX_DESCRIPTION = 160;
export const MAX_TITLE = 60;
/** Same suffix app/layout.tsx's title template appends to every page title. */
export const TITLE_SUFFIX = ` · ${SITE_NAME}`;

/** "Vector 2.0 (orig. Anki Vector)" → "Vector 2.0". Parentheticals are catalog disambiguation notes, not what
 * anyone types into a search box (and they crowd a 60-character title). */
export function plainName(s: string): string {
  return s.replace(/\s*\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim();
}

/** Only a title that has a real FCC record to show claims "FCC status"; the rest promise price and specs. */
export function robotTitle(m: Model): string {
  const name = plainName(m.name);
  return usStatusKind(modelUsStatus(m)) === "unknown" ? `${name} price and specs` : `${name} price, specs and FCC status`;
}

/**
 * One price sentence per situation. The number only ever comes from a price the site itself stands behind:
 * the live daily snapshot, or a sales page a human checked on a recorded date. A "press"/"unknown" price is
 * never quoted (task-prelaunch.md §A.2 — an unverified figure doesn't appear as a bare number anywhere, and
 * a search snippet is the barest place of all).
 */
function priceClause(m: Model): string {
  const sub = subscriptionLabel(m);
  const withSub = sub ? ` (${sub})` : "";
  const live = trackedRange(latestPrices(m.id));
  if (live) return `${m.status === "preorder" ? "Pre-order price" : "Price"} ${rangeText(live.min, live.max)}${withSub}, checked daily.`;
  if (m.tracking_status === "announced") return `Announced${m.expected_launch ? `, expected ${m.expected_launch}` : ""}, not yet on sale.`;

  const shown = purchaseRange(m); // "Quote", "Not verified" (press/unknown) or a checked range
  if (shown === "Quote" || (shown === "Not verified" && m.price_model === "quote")) return "Price on request (quote only).";
  if (shown === "Not verified") return "Current price not verified.";
  const day = m.price_provenance_date && /^\d{4}-\d{2}-\d{2}$/.test(m.price_provenance_date) ? m.price_provenance_date : null;
  return `Listed at ${shown}${withSub}${day ? `, sales page checked ${fmtDate(day)}` : ""}.`;
}

function fccClause(m: Model): string | null {
  const us = modelUsStatus(m);
  const kind = usStatusKind(us);
  if (kind === "unknown") return null;
  const subject = `FCC ID ${m.fcc_ids[0] ?? us.fcc_id ?? "on file"}`;
  if (kind === "before") return `${subject} authorized before the Covered List.`;
  if (kind === "conditional") return `${subject} conditionally approved under the Covered List.`;
  return `${subject} authorized after the Covered List.`;
}

/** How each category reads at the start of a sentence, e.g. "Humanoid specs, US regulatory status and resale notes." */
const CATEGORY_NOUN: Record<Category, string> = { humanoid: "Humanoid", quadruped: "Quadruped", desktop: "Desktop robot", arm: "Robot arm" };

/** Joins the required sentences, then appends the first closing sentence that still fits in a snippet. */
function assemble(required: string[], closers: string[]): string {
  const base = required.join(" ");
  const closer = closers.find((c) => base.length + 1 + c.length <= MAX_DESCRIPTION);
  return closer ? `${base} ${closer}` : base;
}

export function robotDescription(m: Model): string {
  const name = plainName(m.name);
  const maker = plainName(m.manufacturer);
  // "Unitree G1 by Unitree Robotics" repeats itself; only name the maker when the product name doesn't.
  const brandInName = name.toLowerCase().includes(maker.split(" ")[0].toLowerCase());
  const lead = `${brandInName ? name : `${name} by ${maker}`}: ${priceClause(m)}`;
  const fcc = fccClause(m);
  return assemble(fcc ? [lead, fcc] : [lead], [`${CATEGORY_NOUN[m.category]} specs, US regulatory status and resale notes.`, "Specs and resale notes."]);
}

export function homeTitle(): string {
  return `${SITE_NAME} — Humanoid and robot dog prices, tracked daily`;
}

export function homeDescription(): string {
  const models = getModels();
  const tracked = models.filter((m) => m.tracking_status === "tracked").length;
  return `List prices for ${models.length} humanoids, robot dogs and desktop robots, ${tracked} of them checked daily, plus FCC authorization and Covered List status.`;
}

export const CHANGES_TITLE = "Robot price changes and stock updates";
export const CHANGES_DESCRIPTION =
  "Price changes, stock updates and discounts on tracked humanoids, robot dogs and desktop robots, found by the daily collector, plus its health check.";

export const FCC_TITLE = "Robot FCC ID search and Covered List status";
export const FCC_DESCRIPTION = `Search FCC IDs for humanoids, robot dogs and desktop robots and see which were authorized before the ${COVERED_LIST_LABEL} Covered List cutoff.`;

/** Newest per-robot date the site can actually vouch for: the latest daily snapshot for a tracked robot.
 * Robots the collector doesn't read have no such date, so they get none rather than a made-up one. */
export function robotLastModified(modelId: string): string | null {
  const dates = latestPrices(modelId).map((p) => p.date);
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}

// One definition of each page's path, used by both the sitemap and the page's canonical tag so the two can't
// disagree about a URL.
export const HOME_PATH = "/";
export const CHANGES_PATH = "/changes";
export const FCC_PATH = "/fcc";
export const robotPath = (id: string): string => `/robots/${id}`;

/** Absolute URL for a path. The home page is the bare origin, which is what Next writes into its canonical tag. */
export function absoluteUrl(path: string): string {
  return path === HOME_PATH ? SITE_URL : `${SITE_URL}${path}`;
}

export interface SitemapEntry {
  url: string;
  lastModified?: string;
}

/** Every indexable page: home, /changes, /fcc and all catalog robots. /unsubscribe is deliberately left out (noindex). */
export function sitemapEntries(): SitemapEntry[] {
  const withDate = (url: string, date: string | null | undefined): SitemapEntry => (date ? { url, lastModified: date } : { url });
  const snapshot = lastUpdated();
  return [
    withDate(absoluteUrl(HOME_PATH), snapshot),
    withDate(absoluteUrl(CHANGES_PATH), snapshot),
    withDate(absoluteUrl(FCC_PATH), getApprovalStore()?.updated),
    ...getModels().map((m) => withDate(absoluteUrl(robotPath(m.id)), robotLastModified(m.id))),
  ];
}
