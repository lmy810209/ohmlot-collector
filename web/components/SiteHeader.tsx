import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
          Ohmlot
          <span className="rounded-full border border-zinc-300 px-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            v0
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-zinc-600 dark:text-zinc-300">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-white">
            Robots
          </Link>
          <Link href="/fcc" className="hover:text-zinc-900 dark:hover:text-white">
            FCC
          </Link>
        </nav>
      </div>
    </header>
  );
}
