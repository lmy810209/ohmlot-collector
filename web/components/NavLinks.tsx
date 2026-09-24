"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Robots", match: (p: string) => p === "/" || p.startsWith("/robots") },
  { href: "/changes", label: "Changes", match: (p: string) => p.startsWith("/changes") },
  { href: "/fcc", label: "FCC", match: (p: string) => p.startsWith("/fcc") },
];

/** Pill tabs (guide §3): only the active tab gets the white surface + shadow. */
export function NavLinks() {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Primary" className="flex items-center rounded-full bg-sunk p-0.5">
      {LINKS.map((l) => {
        const current = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium transition-colors duration-150 ${
              current ? "bg-card text-ink shadow-card" : "text-ink-2 hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
