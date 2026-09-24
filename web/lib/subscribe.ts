import { browserSupabase } from "./supabase-client";

export type SubscribeResult =
  | { ok: true; status: "subscribed" | "already_subscribed" }
  | { ok: false; reason: "rate_limited" | "invalid_email" | "not_configured" | "network" };

/**
 * Pure — no network — so directly testable (test/subscribe.test.ts). A honeypot field that isn't empty means
 * whatever submitted the form filled in every input on the page, including one no sighted human ever sees
 * (task-prelaunch.md §B.2). Real users never trip this: the field exists but is never presented to them.
 */
export function isHoneypotTripped(honeypotValue: string): boolean {
  return honeypotValue.trim().length > 0;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Same shape check as the database's own CHECK constraint (supabase/migrations/0001_subscribers.sql) — not
 * a replacement for it, just lets the form show "that doesn't look like an email" before ever calling out. */
export function looksLikeEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * The one path both AlertSignup and TrackRobotButton call. A tripped honeypot returns a fake "subscribed"
 * without ever reaching the network — never tell a bot it was caught, and never spend a rate-limit slot on
 * it either. Everything else goes through the subscribe() Postgres function (never a raw table insert); see
 * that function's own comments for why rate limiting and the honeypot-adjacent checks live there too.
 */
export async function subscribe(params: { email: string; modelId: string | null; sourcePage: string; honeypot: string }): Promise<SubscribeResult> {
  if (isHoneypotTripped(params.honeypot)) return { ok: true, status: "subscribed" };
  const email = params.email.trim();
  if (!looksLikeEmail(email)) return { ok: false, reason: "invalid_email" };

  const sb = browserSupabase();
  if (!sb) return { ok: false, reason: "not_configured" };

  const { data, error } = await sb.rpc("subscribe", { p_email: email, p_model_id: params.modelId, p_source_page: params.sourcePage });
  if (error) return { ok: false, reason: "network" };
  if (data === "subscribed" || data === "already_subscribed") return { ok: true, status: data };
  if (data === "rate_limited") return { ok: false, reason: "rate_limited" };
  return { ok: false, reason: "invalid_email" };
}
