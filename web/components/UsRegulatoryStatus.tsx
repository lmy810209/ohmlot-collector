import type { ReactNode } from "react";
import { modelUsStatus, usStatusKind, type FccFact, type Model } from "@/lib/data";
import { COVERED_LIST_LABEL, COVERED_LIST_RULE, FCC_DOCS, fccRecordUrl, fmtDate, humanizeIsoDates } from "@/lib/format";
import { UsStatusBadge } from "./UsStatusBadge";

/** Links inside the block open FCC documents; accent-ink text keeps them findable in a row of plain facts. */
const link = "text-accent-ink underline underline-offset-2 decoration-accent-ink/40 hover:decoration-accent-ink";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-y-1 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-x-4">
      <dt className="micro sm:pt-[3px]">{label}</dt>
      <dd className="min-w-0 text-[14px] leading-relaxed">{children}</dd>
    </div>
  );
}

function FccLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
      {children}
    </a>
  );
}

/** The "US regulatory status" card body: five facts, each linked to the FCC document it comes from. */
export function UsRegulatoryStatus({ model, facts }: { model: Model; facts: FccFact[] }) {
  const s = modelUsStatus(model);
  const kind = usStatusKind(s);
  const hasFccId = facts.length > 0;
  const record = s.source_url ?? fccRecordUrl(s.fcc_id);

  const explanation =
    kind === "before"
      ? `Its FCC grant predates ${COVERED_LIST_LABEL}, so this model can still be sold, imported, and used in the US.`
      : kind === "conditional"
        ? `Granted after ${COVERED_LIST_LABEL}, but exempt from the Covered List through a Department of War Conditional Approval.`
        : kind === "after"
          ? `Granted after ${COVERED_LIST_LABEL}, when foreign-produced robots could no longer receive new FCC authorizations, and not on the Conditional Approvals list. Confirm the grant on the FCC record before buying.`
          : hasFccId
            ? "An FCC ID is on file but its grant date could not be confirmed, so this model's position against the Covered List is unknown."
            : "No FCC equipment authorization is on file for this model, so its US status can't be confirmed here.";

  return (
    <>
      <UsStatusBadge kind={kind} hasFccId={hasFccId} />
      <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-ink-2">{explanation}</p>

      <dl className="mt-4 divide-y divide-line-soft border-y border-line-soft">
        <Row label="FCC ID">
          {hasFccId ? (
            facts.map((f, i) => (
              <span key={f.fcc_id}>
                {i > 0 && <span className="text-ink-3">, </span>}
                <FccLink href={fccRecordUrl(f.fcc_id) ?? FCC_DOCS.search}>
                  <span className="font-mono">{f.fcc_id}</span>
                </FccLink>
              </span>
            ))
          ) : (
            <span className="text-ink-2">
              None on file — <FccLink href={FCC_DOCS.search}>search the FCC database</FccLink>
            </span>
          )}
        </Row>
        <Row label="Grant date">
          {s.grant_date ? (
            <>
              <FccLink href={record ?? FCC_DOCS.search}>
                <span className="num">{fmtDate(s.grant_date)}</span>
              </FccLink>
              {facts.length > 1 && <span className="text-ink-3"> · earliest of {facts.length} grants</span>}
            </>
          ) : (
            <span className="text-ink-2">Unknown</span>
          )}
        </Row>
        <Row label="Covered List">
          {s.covered_list === "before" ? "Authorized before" : s.covered_list === "after" ? "Authorized after" : "No grant date to compare with"} {COVERED_LIST_LABEL}
          {" — "}
          <FccLink href={FCC_DOCS.coveredListNotice}>Covered List notice (DA 26-786)</FccLink>
        </Row>
        <Row label="Conditional approval">
          {s.conditional_approval === true ? "Yes" : s.conditional_approval === false ? "No" : "Not checked"}
          {s.conditional_approval_note ? <span className="text-ink-2"> · {humanizeIsoDates(s.conditional_approval_note)}</span> : null}
          {" — "}
          <FccLink href={FCC_DOCS.conditionalApprovals}>Conditional Approvals list (DA 26-996)</FccLink>
        </Row>
        <Row label="Last verified">
          {s.last_verified ? <span className="num">{fmtDate(s.last_verified)}</span> : <span className="text-ink-2">Not verified against FCC records yet</span>}
          {record && (
            <>
              {" — "}
              <FccLink href={record}>FCC record</FccLink>
            </>
          )}
        </Row>
      </dl>

      <p className="mt-4 text-[12px] text-ink-3">
        {COVERED_LIST_RULE} <FccLink href={FCC_DOCS.factSheet}>FCC fact sheet</FccLink>
      </p>
    </>
  );
}
