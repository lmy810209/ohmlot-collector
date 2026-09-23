import Link from "next/link";
import { Wordmark } from "./Logo";
import { NavLinks } from "./NavLinks";
import { fmtDay } from "@/lib/format";

export function SiteHeader({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex h-10 items-center rounded-md" aria-label="Ohmlot home">
            <Wordmark />
          </Link>
          {lastUpdated && (
            <span className="hidden items-center gap-1.5 font-mono text-[11px] text-ink-2 sm:inline-flex" title="Prices are collected once a day at 00:17 UTC">
              <span className="size-2 rounded-full bg-up" aria-hidden="true" />
              Live · {fmtDay(lastUpdated)}
            </span>
          )}
        </div>
        <NavLinks />
      </div>
    </header>
  );
}
