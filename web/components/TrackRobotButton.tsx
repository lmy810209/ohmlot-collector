"use client";

import { BellIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

/**
 * "Track this robot" — email capture on the model page. v0 logs to the browser console only; the TODO
 * below is the Supabase hook-up (table: alert_signups {email, model_id, created_at}), the same one
 * AlertSignup uses.
 */
export function TrackRobotButton({ modelId, modelName }: { modelId: string; modelName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const inputId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const returnFocus = useRef(false);

  // Keyboard users never lose their place: the status message takes focus after submit, the trigger after cancel.
  useEffect(() => {
    if (done) statusRef.current?.focus();
    else if (!open && returnFocus.current) {
      triggerRef.current?.focus();
      returnFocus.current = false;
    }
  }, [open, done]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    // TODO(supabase): insert { email, model_id } into alert_signups instead of logging.
    console.log("[ohmlot] track robot", { email: trimmed, model_id: modelId, at: new Date().toISOString() });
    setDone(true);
  }

  function cancel() {
    returnFocus.current = true;
    setOpen(false);
  }

  if (done) {
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
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        Email address for {modelName} alerts
      </label>
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
      <button type="submit" className="h-11 rounded-ctl border border-line bg-card px-4 text-sm font-semibold hover:bg-sunk">
        Track
      </button>
      <button type="button" onClick={cancel} className="h-11 rounded-ctl px-3 text-sm text-ink-2 hover:bg-sunk">
        Cancel
      </button>
    </form>
  );
}
