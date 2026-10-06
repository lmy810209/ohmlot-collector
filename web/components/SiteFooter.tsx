import { CHART_MIN_SNAPSHOTS, fmtDate } from "@/lib/format";

export function SiteFooter({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-10 text-[13px] leading-relaxed text-ink-2 sm:px-6 md:grid-cols-3">
        <div>
          <div className="micro mb-2">Sources</div>
          <p>
            Prices: manufacturer and official-reseller stores, US market. Model data: Robot Price Index (CC BY 4.0) and humanoidrecord.com
            (CC BY 4.0). FCC: public equipment-authorization records; verify new IDs on apps.fcc.gov.
          </p>
        </div>
        <div>
          <div className="micro mb-2">Methodology</div>
          <p>
            One snapshot per store per day. &ldquo;Contact us&rdquo; placeholder prices are hidden. Ranges cover the robot&rsquo;s own
            variants; subscriptions and accessories are listed but never set a range. Price history charts appear after {CHART_MIN_SNAPSHOTS} daily snapshots.
            {lastUpdated ? ` Last collection: ${fmtDate(lastUpdated)} (UTC).` : ""}
          </p>
        </div>
        <div>
          <div className="micro mb-2">Not affiliated</div>
          <p>
            Ohmlot is independent and not affiliated with any manufacturer or store. Figures are list prices, not offers, and nothing here is
            legal advice. Import and resale rules change.
          </p>
          <p className="mt-3 text-ink-3">&copy; {new Date().getUTCFullYear()} Ohmlot</p>
        </div>
      </div>
    </footer>
  );
}
