"use client";

import { CantLoad, NotFound } from "@/features/frame/conventions";
import { useSetBreadcrumb } from "@/features/frame/breadcrumb";
import { useSession } from "@/features/frame/session-context";
import { can, ROLE_LABEL } from "@/lib/roles";
import { ReportView } from "./report-view";
import { useValidationReport } from "./use-validation-report";

function Block({ className }: { className: string }) {
  return <div className={`bg-well animate-pulse rounded-md ${className}`} />;
}

function ReportSkeleton({ reading }: { reading: string | null }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading the validation report" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_var(--layout-rail-narrow)]">
      <div className="flex flex-col gap-3">
        <Block className="h-10 w-2/3" />
        <Block className="h-5 w-1/2" />
        <Block className="h-16" />
        <Block className="h-16" />
        <Block className="h-16" />
        {reading ? <p className="text-small text-ink2">{reading}</p> : null}
      </div>
      <Block className="h-48" />
    </div>
  );
}

export function ValidationReportScreen({ unitKey, version }: { unitKey: string; version: number }) {
  const s = useValidationReport(unitKey, version);
  const { role } = useSession();
  // roles.ts has no "confirm report" action; start_run (author only) stands in and the server stays the authority (ROLE_FORBIDDEN).
  const canEdit = can(role, "start_run");
  const title = s.unit?.title ?? unitKey;
  useSetBreadcrumb([
    { label: "Units", href: "/units" },
    { label: title, href: `/units/${unitKey}/board` },
    { label: "Validation report" },
  ]);

  if (s.phase === "notfound") {
    return <NotFound what={`outline version ${version}`} boardHref={`/units/${unitKey}/board`} where={title} />;
  }
  if (s.phase === "error") return <CantLoad thing="the validation report" onRetry={s.reload} />;
  if (s.phase !== "ready" || !s.report || !s.versionInfo) {
    return <ReportSkeleton reading={s.phase === "slow" ? `Reading ${s.totalRows ?? ""} rows…`.replace("  ", " ") : null} />;
  }
  return (
    <ReportView
      report={s.report}
      unit={{ title, unitKey }}
      version={{ created_by: s.versionInfo.created_by, created_at: s.versionInfo.created_at }}
      newer={s.newer}
      canEdit={canEdit}
      roleLabel={ROLE_LABEL[role]}
      status={s.status}
      refusal={s.refusal}
      forbidden={s.forbidden}
      generating={s.generating}
      actions={s.actions}
      dialogOpen={s.dialogOpen}
      onCloseDialog={s.closeDialog}
    />
  );
}
