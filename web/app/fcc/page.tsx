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
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">FCC ID search</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Equipment authorizations on file for the robots in this catalog. On {COVERED_LIST_LABEL} the FCC added
        foreign-produced advanced robotic devices to its Covered List; grants dated after that are flagged.
      </p>
      <div className="mt-6">
        <FccSearch items={items} />
      </div>
    </div>
  );
}
