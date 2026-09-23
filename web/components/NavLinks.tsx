"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Robots", match: (p: string) => p === "/" || p.startsWith("/robots") },
  { href: "/fcc", label: "FCC", match: (p: string) => p.startsWith("/fcc") },
];

export function NavLinks() {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Primary" className="flex items-center gap-1">
      {LINKS.map((l) => {
        const current = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? "page" : undefined}
            className={`inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors ${
              current ? "text-foreground underline decoration-brand decoration-2 underline-offset-8" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
