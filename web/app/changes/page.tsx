import type { Metadata } from "next";
import { CollectionStatusCard } from "@/components/CollectionStatusCard";
import { ChangesList } from "@/components/ChangesList";
import { collectionStatus, observationEvents, realEvents } from "@/lib/data";
import { CHANGES_DESCRIPTION, CHANGES_TITLE } from "@/lib/seo";

export const metadata: Metadata = {
  title: CHANGES_TITLE,
  description: CHANGES_DESCRIPTION,
};

export default function ChangesPage() {
  const status = collectionStatus();
  const real = realEvents();
  const observation = observationEvents();

  return (
    <div className="py-10 sm:py-14">
      <div className="micro mb-2">Changes</div>
      <h1 className="text-[30px] font-extrabold sm:text-[38px]">What changed</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-ink-2">
        Every price, availability, and discount change the daily collector has found — generated automatically by comparing each day&rsquo;s
        snapshot to the one before it. Nothing here is hand-entered.
      </p>

      <div className="mt-6">
        <CollectionStatusCard status={status} />
      </div>

      <div className="mt-6">
        <ChangesList real={real} observation={observation} />
      </div>
    </div>
  );
}
