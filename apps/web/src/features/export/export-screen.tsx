"use client";

import { useSearchParams } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { CantLoad, NotFound, RoleNote } from "@/features/frame/conventions";
import { useSession } from "@/features/frame/session-context";
import { unitIdFromKey } from "@/lib/keys";
import { can } from "@/lib/roles";
import { COPY, downloadFailed, sameMessage, writtenMessage } from "./copy";
import { ExportGate } from "./export-gate";
import { HeldBackList } from "./held-back-list";
import { SnapshotsTable } from "./snapshots-table";
import { useExports } from "./use-exports";
import { VersionsTable } from "./versions-table";

function unitLabel(unitKey: string): string {
  const id = unitIdFromKey(unitKey);
  const m = id && /^G(\d+)\.U(\d+)$/.exec(id);
  return m ? `Grade ${m[1]} · Unit ${m[2]}` : unitKey;
}

export function ExportScreen({ unitKey }: { unitKey: string }) {
  return (
    <ExportGate>
      <ExportBody unitKey={unitKey} />
    </ExportGate>
  );
}

function ExportBody({ unitKey }: { unitKey: string }) {
  const { role } = useSession();
  const selected = useSearchParams().get("export");
  const x = useExports(unitKey);
  const mayExport = can(role, "export");

  if (x.notFound)
    return (
      <NotFound
        what="unit"
        boardHref={`/units/${unitKey}/board`}
        where={unitLabel(unitKey)}
      />
    );
  if (x.forbidden)
    return (
      <>
        <PageHeader
          eyebrow="Unit"
          title={COPY.title}
          meta={unitLabel(unitKey)}
        />
        <RoleNote>{COPY.onlyApprovers}</RoleNote>
      </>
    );
  if (!x.data && !x.error)
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading export</span>
        <div aria-hidden className="bg-well h-28 animate-pulse rounded-xl" />
      </div>
    );
  if (!x.data) return <CantLoad thing="export" onRetry={x.retry} />;

  const { included, held_back, exports } = x.data;
  const nothing = included.length === 0 && held_back.length === 0;

  return (
    <>
      <PageHeader eyebrow="Unit" title={COPY.title} meta={unitLabel(unitKey)} />
      <div className="flex flex-col gap-5">
        {!mayExport ? <RoleNote>{COPY.onlyApprovers}</RoleNote> : null}
        {nothing ? (
          <p className="text-body text-ink">{COPY.empty}</p>
        ) : (
          <>
            {included.length > 0 ? <SnapshotsTable rows={included} /> : null}
            <HeldBackList items={held_back} />
          </>
        )}
        {mayExport ? (
          <div className="flex flex-col items-start gap-2">
            <Button loading={x.pending} onClick={() => void x.create()}>
              {x.pending ? COPY.creating : COPY.create}
            </Button>
            <div role="status" className="text-body text-ink">
              {x.result?.kind === "written"
                ? writtenMessage(x.result.version, x.result.count)
                : x.result?.kind === "same"
                  ? sameMessage(x.result.version)
                  : null}
            </div>
          </div>
        ) : null}
        {x.problem === "failed" ? (
          <Banner level="blocking" title={COPY.createFailed} />
        ) : null}
        {x.problem === "forbidden" ? (
          <Banner level="blocking" title={COPY.onlyApprovers} />
        ) : null}
        {x.downloadFailedFor !== null ? (
          <Banner
            level="blocking"
            title={downloadFailed(x.downloadFailedFor)}
          />
        ) : null}
        {exports.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-label text-ink2">{COPY.earlier}</h2>
            <VersionsTable
              rows={exports}
              selected={selected}
              onDownload={(id, n) => void x.download(id, n)}
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
