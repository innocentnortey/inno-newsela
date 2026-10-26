import { Link } from "@/components/ui/link";
import type { Role } from "@/lib/roles";
import { runHref, validationReportHref } from "./row-href";

export interface BoardEmptyProps {
  role: Role;
  unitKey: string;
  latestVersion?: number | undefined;
  runId?: string | null | undefined;
  /** True when the unit has no outline at all (no run, no version). */
  noOutline?: boolean;
}

export function BoardEmpty({ role, unitKey, latestVersion, runId, noOutline }: BoardEmptyProps) {
  let link: React.ReactNode = null;
  if (noOutline) {
    link = role === "author" ? <Link href={`/units/${unitKey}/outlines/new`}>Upload an outline</Link> : null;
  } else if (role === "author") {
    link = latestVersion ? <Link href={validationReportHref(unitKey, latestVersion)}>Go to the validation report</Link> : null;
  } else if (runId) {
    link = <Link href={runHref(unitKey, runId)}>See the latest run</Link>;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-title-sm">No lessons generated for this unit yet.</p>
      <p className="text-small text-ink2">Lessons appear here as a run drafts them.</p>
      {link}
    </div>
  );
}
