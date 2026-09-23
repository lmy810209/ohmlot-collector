import { Badge, type Tone } from "./Badge";
import type { UsStatusKind } from "@/lib/data";

/** The four US regulatory states, worded and colored the same everywhere they appear. */
export const US_STATUS_LABEL: Record<UsStatusKind, string> = {
  before: "Authorized before the Covered List",
  conditional: "Conditionally approved",
  after: "After the Covered List — check before buying",
  unknown: "No FCC record on file",
};

/** Shorter wording for table cells and the search list. */
export const US_STATUS_SHORT: Record<UsStatusKind, string> = {
  before: "Before Covered List",
  conditional: "Conditional approval",
  after: "After Covered List",
  unknown: "No FCC record",
};

/** before = plain fact (neutral), conditional = caution (amber), after = warning (down), unknown = grey. */
export const US_STATUS_TONE: Record<UsStatusKind, Tone> = {
  before: "neutral",
  conditional: "amber",
  after: "down",
  unknown: "muted",
};

export function UsStatusBadge({ kind, short = false }: { kind: UsStatusKind; short?: boolean }) {
  return <Badge tone={US_STATUS_TONE[kind]}>{short ? US_STATUS_SHORT[kind] : US_STATUS_LABEL[kind]}</Badge>;
}
