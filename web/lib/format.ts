import type { Category, Model } from "./data";

/** FCC DA 26-786: foreign-produced advanced robotic devices were added to the Covered List on this date. */
export const COVERED_LIST_DATE = "2026-07-28";

export type Priced = Pick<Model, "price_model" | "price_usd_min" | "price_usd_max" | "subscription_usd_month">;

export function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

/** "$1,600–$4,500" or "$13,500". */
export function rangeText(min: number, max: number): string {
  return min === max ? usd(min) : `${usd(min)}–${usd(max)}`;
}

/** Published purchase price: "$1,600–$4,500", "$13,500" or "Quote". Subscriptions are labelled separately. */
export function purchaseRange(m: Priced): string {
  if (m.price_model === "quote" || (m.price_usd_min == null && m.price_usd_max == null)) return "Quote";
  const min = m.price_usd_min ?? (m.price_usd_max as number);
  const max = m.price_usd_max ?? min;
  return rangeText(min, max);
}

/** "$499/mo subscription" or null. */
export function subscriptionLabel(m: Priced): string | null {
  return m.subscription_usd_month != null ? `${usd(m.subscription_usd_month)}/mo subscription` : null;
}

/** One-line summary for metadata: "$20,000 · $499/mo subscription". */
export function priceRange(m: Priced): string {
  const sub = subscriptionLabel(m);
  return sub ? `${purchaseRange(m)} · ${sub}` : purchaseRange(m);
}

function utcDate(iso: string): Date {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d));
}

/** "Sep 23, 2026" */
export function fmtDate(iso: string): string {
  return utcDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "May 2024" */
export function fmtMonth(iso: string): string {
  return utcDate(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export const COVERED_LIST_LABEL = fmtDate(COVERED_LIST_DATE);

export const CATEGORY_LABEL: Record<Category, string> = {
  humanoid: "Humanoids",
  quadruped: "Quadrupeds",
  desktop: "Desktop robots",
  arm: "Arms",
};

export const CATEGORY_SINGULAR: Record<Category, string> = {
  humanoid: "Humanoid",
  quadruped: "Quadruped",
  desktop: "Desktop",
  arm: "Arm",
};

export const CATEGORY_ORDER: Category[] = ["humanoid", "quadruped", "desktop", "arm"];

export const STATUS_LABEL: Record<string, string> = {
  shipping: "Shipping",
  preorder: "Pre-order",
};

export function pct(n: number): string {
  const s = n.toFixed(Math.abs(n) < 10 ? 1 : 0);
  return (n > 0 ? "+" : "") + s + "%";
}
