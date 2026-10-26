"use client";
import { placeLabel } from "@/features/workspace/state-model";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SideRail, TwoPane } from "@/components/layout/two-pane";
import { useSetBreadcrumb } from "@/features/frame/breadcrumb";
import { CantLoad, NotFound } from "@/features/frame/conventions";
import { api } from "@/lib/api-client";
import { AuditLog } from "./audit-log";
import { COPY } from "./copy";
import {
  auditFor,
  lessonNumber,
  selectedVersion,
  unitLabelFromKey,
} from "./derive";
import { HistorySkeleton } from "./history-skeleton";
import { Provenance } from "./provenance";
import { useHistoryData, type ApiClient } from "./use-history-data";
import { VersionList } from "./version-list";

export interface HistoryScreenProps {
  unitKey: string;
  lessonKey: string;
  lessonId: string;
  client?: ApiClient;
}

export function HistoryScreen({
  unitKey,
  lessonKey,
  lessonId,
  client,
}: HistoryScreenProps) {
  const data = useHistoryData(client ?? api, lessonId);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const n = lessonNumber(lessonId);
  const board = `/units/${unitKey}/board`;
  useSetBreadcrumb([
    { label: unitLabelFromKey(unitKey), href: board },
    { label: `Lesson ${n}`, href: `/units/${unitKey}/lessons/${lessonKey}` },
    { label: "History" },
  ]);

  if (data.status === "error") {
    return data.error?.code === "NOT_FOUND" ? (
      <NotFound what={`Lesson ${n}`} where={placeLabel(unitKey)} boardHref={board} />
    ) : (
      <CantLoad thing={COPY.cantLoadThing} onRetry={() => void data.reload()} />
    );
  }
  if (data.status === "loading" || !data.history) return <HistorySkeleton />;
  const history = data.history;
  const selected = selectedVersion(
    history.versions,
    searchParams.get("version"),
  );
  if (!selected)
    return (
      <CantLoad thing={COPY.cantLoadThing} onRetry={() => void data.reload()} />
    );

  return (
    <>
      <PageHeader
        eyebrow={COPY.eyebrow}
        title={COPY.title(n)}
      />
      <TwoPane
        rail={
          <SideRail title={COPY.provenanceHeading}>
            <Provenance version={selected} />
            <AuditLog rows={auditFor(history.audit, selected)} />
          </SideRail>
        }
      >
        <h2 className="text-ink mb-3 text-sm font-semibold">
          {COPY.versionsHeading}
        </h2>
        <VersionList
          versions={history.versions}
          audit={history.audit}
          selected={selected.version_number}
          onSelect={(v) =>
            router.replace(`${pathname}?version=${v}`, { scroll: false })
          }
        />
      </TwoPane>
    </>
  );
}
