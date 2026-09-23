import type { Metadata } from "next";
import { FccSearch } from "@/components/FccSearch";
import { fccSearchItems } from "@/lib/data";
import { COVERED_LIST_RULE, FCC_DOCS } from "@/lib/format";

export const metadata: Metadata = {
  title: "FCC ID search and US status",
  description: "Search personal-robot FCC equipment authorizations by model name or FCC ID, filtered by Covered List status.",
};

export default function FccPage() {
  const items = fccSearchItems();
  return (
    <div className="py-10 sm:py-14">
      <div className="micro mb-2">FCC</div>
      <h1 className="text-[30px] font-extrabold sm:text-[38px]">FCC ID search</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-ink-2">
        Equipment authorizations on file for the robots in this catalog, each placed before or after the Covered List. {COVERED_LIST_RULE}{" "}
        <a href={FCC_DOCS.coveredListNotice} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:decoration-ink">
          FCC DA 26-786
        </a>
      </p>
      <div className="mt-6">
        <FccSearch items={items} />
      </div>
    </div>
  );
}
