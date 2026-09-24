"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase-client";

type State = "missing_token" | "working" | "done" | "not_found" | "error";

/**
 * task-prelaunch.md §B.4: built before any email is ever sent, so the link in the first real alert email
 * already works. Calls the unsubscribe() Postgres function (supabase/migrations/0001_subscribers.sql) — the
 * only thing the public anon key can do to this row besides insert it in the first place.
 */
export function UnsubscribeForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>(token ? "working" : "missing_token");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const sb = browserSupabase();
      if (!sb) {
        if (!cancelled) setState("error");
        return;
      }
      const { data, error } = await sb.rpc("unsubscribe", { p_token: token });
      if (cancelled) return;
      if (error) setState("error");
      else setState(data ? "done" : "not_found");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "missing_token") {
    return <p className="text-[14px] text-ink-2">This link is missing its token &mdash; use the unsubscribe link from an email, not this page directly.</p>;
  }
  if (state === "working") {
    return <p className="text-[14px] text-ink-2">Working&hellip;</p>;
  }
  if (state === "done") {
    return (
      <p role="status" className="text-[14px] text-ink-2">
        You&rsquo;re unsubscribed. That email address has been removed &mdash; nothing more will be sent.
      </p>
    );
  }
  if (state === "not_found") {
    return (
      <p role="status" className="text-[14px] text-ink-2">
        This link has already been used, or the subscription no longer exists. Either way, you&rsquo;re not on the list.
      </p>
    );
  }
  return (
    <p role="alert" className="text-[14px] text-down">
      Something went wrong. Reload this page to try again, or if it keeps failing, the signup itself failed too &mdash; you were likely never
      subscribed.
    </p>
  );
}
