"use client";

import { Banner } from "@/components/ui/banner";
import { CodeChip, VersionChip } from "@/components/ui/badge";
import { Link } from "@/components/ui/link";
import { PageHeader } from "@/components/layout/page-header";
import { PageSheet } from "@/components/layout/page-sheet";
import { TwoPane } from "@/components/layout/two-pane";
import { StartRunDialog } from "@/features/start-run/start-run-dialog";
import { ErrorsSection } from "./errors-section";
import { OkRows } from "./ok-rows";
import { formatClock, type Report, type ReportActions, type TargetStatus } from "./report-model";
import { SummaryRail } from "./summary-rail";
import { WarningsSection } from "./warnings-section";

export interface ReportViewProps {
  report: Report;
  unit: { title: string; unitKey: string };
  version: { created_by: string; created_at: string };
  newer: { version_number: number; created_at: string; same_as_version: number | null; changed_lessons: number } | null;
  canEdit: boolean;
  roleLabel: string;
  status: Record<string, TargetStatus>;
  refusal: string | null;
  forbidden: string | null;
  generating: boolean;
  actions: ReportActions;
  dialogOpen: boolean;
  onCloseDialog(): void;
}

export function ReportView(p: ReportViewProps) {
  const { report, newer } = p;
  const n = report.version_number;
  const run = report.runs_from_this_version[0];
  return (
    <TwoPane
      railWidth="rail-narrow"
      rail={<SummaryRail report={report} canEdit={p.canEdit} generating={p.generating} onGenerate={() => void p.actions.generate()} />}
    >
      <PageSheet measure="full">
        <PageHeader
          eyebrow={`Outline v${n} · validation report`}
          title={p.unit.title}
          meta={
            <span className="flex flex-wrap items-center gap-2">
              <span>{`uploaded by ${p.version.created_by} at ${formatClock(p.version.created_at)}`}</span>
              <VersionChip version={`v${n}`} />
              <CodeChip>{report.sha256.slice(0, 7)}</CodeChip>
            </span>
          }
        />
        <div className="flex flex-col gap-3">
          {!p.canEdit ? (
            <p className="text-small text-ink2">{`You're viewing as ${/^[aeiou]/i.test(p.roleLabel) ? "an" : "a"} ${p.roleLabel.toLowerCase()}. Only authors confirm the report.`}</p>
          ) : null}
          {p.forbidden ? <Banner level="blocking" title={p.forbidden} /> : null}
          {p.refusal ? <Banner level="blocking" title={p.refusal} /> : null}
          {newer ? (
            <Banner
              level="info"
              title={
                newer.same_as_version === n
                  ? `Version ${newer.version_number} is the same as version ${n}; ${newer.changed_lessons} lessons changed.`
                  : `This is version ${n}. Version ${newer.version_number} was uploaded at ${formatClock(newer.created_at)}.`
              }
              action={<Link href={`/units/${p.unit.unitKey}/outlines/${newer.version_number}`}>{`Open version ${newer.version_number}`}</Link>}
            />
          ) : null}
          {run ? (
            <Banner
              level="info"
              title={`A run started from these choices at ${formatClock(run.started_at)}. Changes apply to the next run.`}
            />
          ) : null}
        </div>
        <ErrorsSection report={report} canEdit={p.canEdit} status={p.status} actions={p.actions} />
        <WarningsSection report={report} canEdit={p.canEdit} status={p.status} actions={p.actions} />
        <OkRows report={report} />
      </PageSheet>
      <StartRunDialog outlineVersionId={report.outline_version_id} open={p.dialogOpen} onClose={p.onCloseDialog} />
    </TwoPane>
  );
}
