import type { Metadata } from "next";
import { FccSearch } from "@/components/FccSearch";
import { fccSearchItems, getApprovalStore, roboticApprovals } from "@/lib/data";
import { COVERED_LIST_RULE, FCC_DOCS } from "@/lib/format";

export const metadata: Metadata = {
  title: "FCC ID search and US status",
  description: "Search personal-robot FCC equipment authorizations by model name or FCC ID, filtered by Covered List status.",
};

export default function FccPage() {
  const items = fccSearchItems();
  const approvals = roboticApprovals();
  const approvalsAsOf = getApprovalStore()?.updated || null;
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
      <p className="mt-2 max-w-2xl text-[13px] text-ink-3">
        {approvals.length === 0
          ? `We checked all three Appendix B columns (UAS, Routers, and Robotic Devices) — no Conditional Approval for a robotic device has been confirmed yet${approvalsAsOf ? `, as of ${approvalsAsOf}` : ""}.`
          : `Robotic-device manufacturers found in FCC Conditional Approval notices: ${[...new Set(approvals.map((a) => a.company ?? a.entry))].join(", ")}. None of these match the robots below.`}{" "}
        <a href={FCC_DOCS.conditionalApprovals} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:decoration-ink">
          FCC Conditional Approvals
        </a>
        . We don&rsquo;t draw conclusions about resale value from this — it&rsquo;s shown as a fact, not advice.
      </p>
      <div className="mt-6">
        <FccSearch items={items} />
      </div>
    </div>
  );
}
