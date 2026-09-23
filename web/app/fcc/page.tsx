import type { Metadata } from "next";
import { FccSearch } from "@/components/FccSearch";
import { fccSearchItems } from "@/lib/data";
import { COVERED_LIST_LABEL } from "@/lib/format";

export const metadata: Metadata = {
  title: "FCC ID search",
  description: "Search personal-robot FCC equipment authorizations by model name or FCC ID.",
};

export default function FccPage() {
  const items = fccSearchItems();
  return (
    <div className="py-10 sm:py-14">
      <div className="micro mb-2">FCC</div>
      <h1 className="text-[30px] font-extrabold sm:text-[38px]">FCC ID search</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-ink-2">
        Equipment authorizations on file for the robots in this catalog. On {COVERED_LIST_LABEL} the FCC added
        foreign-produced advanced robotic devices to its Covered List; grants dated after that are flagged.
      </p>
      <div className="mt-6">
        <FccSearch items={items} />
      </div>
    </div>
  );
}
