"use client";

import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { HoneypotField } from "./HoneypotField";
import { SubscribeDisclosure } from "./SubscribeDisclosure";
import { subscribe } from "@/lib/subscribe";

const ERROR_TEXT: Record<string, string> = {
  invalid_email: "That doesn’t look like an email address.",
  rate_limited: "Too many attempts from this connection — wait a minute and try again.",
  not_configured: "Signups aren’t available right now.",
  network: "Something went wrong — try again in a moment.",
};

/** Email alert CTA (guide §4.6). Inserts through the subscribe() Postgres function — see
 * supabase/migrations/0001_subscribers.sql; never a raw table write, never a subscriber count shown. */
export function AlertSignup() {
  const pathname = usePathname();
  const modelId = pathname?.startsWith("/robots/") ? (pathname.split("/")[2] ?? null) : null;
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setState("sending");
    const result = await subscribe({ email: trimmed, modelId, sourcePage: pathname ?? "/", honeypot });
    if (result.ok) {
      setState("done");
    } else {
      setState("error");
      setError(ERROR_TEXT[result.reason] ?? ERROR_TEXT.network);
    }
  }

  return (
    <section aria-labelledby="alerts-heading" className="card grid grid-cols-1 gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:items-center">
      <div>
        <div className="micro mb-2">Alerts</div>
        <h2 id="alerts-heading" className="text-[22px] font-bold sm:text-2xl">
          {modelId ? "Know when this robot's price moves." : "Know when a tracked price moves."}
        </h2>
        <p className="mt-2 max-w-md text-[14px] text-ink-2">
          One email per change, nothing else. New FCC grants for a robot you watch count as a change.
        </p>
      </div>
      {state === "done" ? (
        <p role="status" className="rounded-ctl border border-line bg-sunk px-4 py-3 text-sm">
          You&rsquo;re on the list. We&rsquo;ll email you when something changes.
        </p>
      ) : (
        <div>
          <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="alert-email" className="sr-only">
              Email address
            </label>
            <HoneypotField value={honeypot} onChange={setHoneypot} />
            <input
              id="alert-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 flex-1 rounded-ctl border border-line bg-card px-3 text-[15px] text-ink placeholder:text-ink-3"
            />
            <button type="submit" disabled={state === "sending"} className="h-11 rounded-ctl bg-accent px-5 text-sm font-semibold text-accent-fg hover:brightness-95 disabled:opacity-60">
              {state === "sending" ? "Sending…" : "Notify me"}
            </button>
          </form>
          {state === "error" && error && (
            <p role="alert" className="mt-2 text-[12.5px] text-down">
              {error}
            </p>
          )}
          <SubscribeDisclosure />
        </div>
      )}
    </section>
  );
}
