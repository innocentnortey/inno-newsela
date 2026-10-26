"use client";

import { TwoPane } from "@/components/layout/two-pane";
import { PageHeader } from "@/components/layout/page-header";
import { CantLoad, RoleNote } from "@/features/frame/conventions";
import { useSession } from "@/features/frame/session-context";
import { can } from "@/lib/roles";
import { COPY } from "./copy";
import { GuidanceEditor } from "./guidance-editor";
import { LockedLayer } from "./locked-layer";
import { PromptGuidanceGate } from "./prompt-guidance-gate";
import { TrialPanel } from "./trial-panel";
import { useGuidance } from "./use-guidance";
import { VersionView } from "./version-view";
import { VersionsList } from "./versions-list";

export function PromptGuidanceScreen() {
  return (
    <PromptGuidanceGate>
      <PromptGuidanceBody />
    </PromptGuidanceGate>
  );
}

function PromptGuidanceBody() {
  const { role } = useSession();
  const g = useGuidance();
  const mayEdit = can(role, "save_prompt_guidance") && !g.forbidden;

  if (!g.data || !g.selected) {
    return (
      <>
        <PageHeader title={COPY.title} />
        {g.error ? (
          <CantLoad thing="prompt guidance" onRetry={g.retry} />
        ) : (
          <div aria-busy="true">
            <span className="sr-only">Loading prompt guidance</span>
            <div
              aria-hidden
              className="bg-well h-28 animate-pulse rounded-xl"
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader title={COPY.title} />
      <TwoPane
        rail={
          <VersionsList
            versions={g.versions}
            selectedId={g.selected.version_id}
          />
        }
      >
        <div className="flex flex-col gap-6">
          {!mayEdit ? <RoleNote>{COPY.onlyAuthors}</RoleNote> : null}
          <VersionView version={g.selected} />
          <LockedLayer text={g.data.locked_layer.text} />
          {mayEdit ? (
            <>
              <GuidanceEditor
                versions={g.versions}
                saving={g.saving}
                problem={g.problem}
                message={g.message}
                onSave={g.save}
              />
              <TrialPanel
                promptVersionId={g.data.current_prompt_version_id}
                isLatest={g.selected.version_id === g.latest?.version_id}
                onForbidden={g.markForbidden}
              />
            </>
          ) : null}
        </div>
      </TwoPane>
    </>
  );
}
