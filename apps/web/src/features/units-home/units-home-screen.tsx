"use client";

import { PageHeader } from "@/components/layout";
import { Link } from "@/components/ui/link";
import { CantLoad } from "@/features/frame/conventions";
import { useSetBreadcrumb } from "@/features/frame/breadcrumb";
import { buildNav } from "@/features/frame/nav";
import { useSession } from "@/features/frame/session-context";
import { can } from "@/lib/roles";
import { MVP_UNIT_KEY, routes } from "./format";
import { LinkButton } from "./link-button";
import { UnitCard } from "./unit-card";
import { UnitsSkeleton } from "./units-skeleton";
import { useUnitsHome } from "./use-units-home";
import { VersionsTable } from "./versions-table";

const EMPTY = "No outline uploaded yet. Upload the unit's outline sheet to see its validation report before any lesson is drafted.";

export function UnitsHomeScreen() {
  const { role } = useSession();
  useSetBreadcrumb([{ label: "Units" }]);
  const { state, retry } = useUnitsHome();
  const promptGuidance = can(role, "view_prompt_guidance")
    ? buildNav(role, "/units")[0]?.items.find((i) => i.id === "prompt-guidance")
    : undefined;
  const canUpload = can(role, "upload_outline");

  const uploadKey = state.kind === "ready" ? (state.units[0]?.unit_key ?? MVP_UNIT_KEY) : MVP_UNIT_KEY;
  const actions =
    state.kind === "ready" && (canUpload || promptGuidance) ? (
      <>
        {canUpload ? <LinkButton href={routes(uploadKey).upload}>Upload outline</LinkButton> : null}
        {promptGuidance ? (
          <Link href={promptGuidance.href} className="font-semibold">
            Prompt guidance
          </Link>
        ) : null}
      </>
    ) : undefined;

  return (
    <div className="flex flex-col gap-(--space-4)">
      <PageHeader title="Units" actions={actions} />
      {state.kind === "loading" ? <UnitsSkeleton /> : null}
      {state.kind === "error" ? <CantLoad thing="units" onRetry={retry} /> : null}
      {state.kind === "ready" && state.units.length === 0 ? <p className="text-body text-ink">{EMPTY}</p> : null}
      {state.kind === "ready"
        ? state.units.map((u) => (
            <div key={u.unit_id} className="flex flex-col gap-(--space-4)">
              <UnitCard unit={u} progress={u.latest_run ? state.progress[u.latest_run.run_id] : undefined} />
              <VersionsTable unitKey={u.unit_key} versions={u.versions} />
            </div>
          ))
        : null}
    </div>
  );
}
