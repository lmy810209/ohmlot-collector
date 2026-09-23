import Link from "next/link";
import { Wordmark } from "./Logo";
import { NavLinks } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex h-10 items-center rounded-md" aria-label="Ohmlot home">
          <Wordmark />
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
