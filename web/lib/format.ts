import type { Category, Model } from "./data";

export function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

/** "$1,600–$4,500", "$13,500", "Quote", with "· $499/mo" appended when a subscription exists. */
export function priceRange(m: Model): string {
  const parts: string[] = [];
  if (m.price_model === "quote" || (m.price_usd_min == null && m.price_usd_max == null)) {
    parts.push("Quote");
  } else if (m.price_usd_min != null && m.price_usd_max != null && m.price_usd_min !== m.price_usd_max) {
    parts.push(`${usd(m.price_usd_min)}–${usd(m.price_usd_max)}`);
  } else {
    parts.push(usd((m.price_usd_min ?? m.price_usd_max) as number));
  }
  if (m.subscription_usd_month != null) parts.push(`${usd(m.subscription_usd_month)}/mo`);
  return parts.join(" · ");
}

export function fmtDate(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const CATEGORY_LABEL: Record<Category, string> = {
  humanoid: "Humanoids",
  quadruped: "Quadrupeds",
  desktop: "Desktop robots",
  arm: "Arms",
};

export const CATEGORY_ORDER: Category[] = ["humanoid", "quadruped", "desktop", "arm"];

export const STATUS_LABEL: Record<string, string> = {
  shipping: "Shipping",
  preorder: "Pre-order",
};
