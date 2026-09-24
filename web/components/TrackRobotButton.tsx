"use client";

import { BellIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { HoneypotField } from "./HoneypotField";
import { SubscribeDisclosure } from "./SubscribeDisclosure";
import { subscribe } from "@/lib/subscribe";

const ERROR_TEXT: Record<string, string> = {
  invalid_email: "That doesn’t look like an email address.",
  rate_limited: "Too many attempts from this connection — wait a minute and try again.",
  not_configured: "Signups aren’t available right now.",
  network: "Something went wrong — try again in a moment.",
};

/** "Track this robot" — email capture on the model page. Inserts through the subscribe() Postgres function
 * (supabase/migrations/0001_subscribers.sql), the same one AlertSignup uses, scoped to this one model_id. */
export function TrackRobotButton({ modelId, modelName }: { modelId: string; modelName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const returnFocus = useRef(false);

  // Keyboard users never lose their place: the status message takes focus after submit, the trigger after cancel.
  useEffect(() => {
    if (state === "done") statusRef.current?.focus();
    else if (!open && returnFocus.current) {
      triggerRef.current?.focus();
      returnFocus.current = false;
    }
  }, [open, state]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setState("sending");
    const result = await subscribe({ email: trimmed, modelId, sourcePage: `/robots/${modelId}`, honeypot });
    if (result.ok) {
      setState("done");
    } else {
      setState("error");
      setError(ERROR_TEXT[result.reason] ?? ERROR_TEXT.network);
    }
  }

  function cancel() {
    returnFocus.current = true;
    setOpen(false);
  }

  if (state === "done") {
    return (
      <p ref={statusRef} tabIndex={-1} role="status" className="max-w-md rounded-ctl border border-line bg-sunk px-4 py-2.5 text-sm text-ink-2 outline-none">
        You&rsquo;re on the list for {modelName}. One email per change, nothing else.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-ctl border border-line bg-card px-5 text-sm font-medium hover:bg-sunk"
      >
        <BellIcon className="size-4" aria-hidden="true" />
        Track this robot
      </button>
    );
  }

  return (
    <div className="max-w-md">
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          Email address for {modelName} alerts
        </label>
        <HoneypotField value={honeypot} onChange={setHoneypot} />
        <input
          id={inputId}
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 w-56 rounded-ctl border border-line bg-card px-3 text-[15px] text-ink placeholder:text-ink-3"
        />
        <button type="submit" disabled={state === "sending"} className="h-11 rounded-ctl border border-line bg-card px-4 text-sm font-semibold hover:bg-sunk disabled:opacity-60">
          {state === "sending" ? "Sending…" : "Track"}
        </button>
        <button type="button" onClick={cancel} className="h-11 rounded-ctl px-3 text-sm text-ink-2 hover:bg-sunk">
          Cancel
        </button>
      </form>
      {state === "error" && error && (
        <p role="alert" className="mt-2 text-[12.5px] text-down">
          {error}
        </p>
      )}
      <SubscribeDisclosure />
    </div>
  );
}
