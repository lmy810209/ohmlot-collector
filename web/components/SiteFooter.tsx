import { AlertSignup } from "./AlertSignup";

export function SiteFooter({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <AlertSignup />
        <div className="mt-10 space-y-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          <p>
            Prices are manufacturer list prices collected once a day from official stores (US market). &ldquo;Contact
            us&rdquo; placeholder prices are hidden. FCC data is from public equipment-authorization records; verify new
            IDs on apps.fcc.gov before relying on them.
            {lastUpdated ? ` Last price snapshot: ${lastUpdated} (UTC).` : ""}
          </p>
          <p>
            Model data includes CC BY 4.0 material from Robot Price Index (robotpriceindex.com) and humanoidrecord.com.
            Nothing here is legal advice; import and resale rules change.
          </p>
          <p>&copy; {new Date().getUTCFullYear()} Ohmlot</p>
        </div>
      </div>
    </footer>
  );
}
