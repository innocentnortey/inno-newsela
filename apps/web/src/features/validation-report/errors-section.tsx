"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeChip, CountBadge } from "@/components/ui/badge";
import { Glyph } from "@/components/ui/glyph";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { ConfirmedLine, FailureLine } from "./confirmed-line";
import { FixEditor } from "./fix-editor";
import { FINDING_SENTENCE } from "./kind-labels";
import { errorItems, headingCopy, type ErrorItem, type Report, type ReportActions, type TargetStatus } from "./report-model";

interface Props {
  report: Report;
  canEdit: boolean;
  status: Record<string, TargetStatus>;
  actions: ReportActions;
}

function Proposed({ item }: { item: ErrorItem }) {
  const fix = item.finding.proposed_fix;
  if (fix === null) return <p className="text-small text-ink2">No fix proposed</p>;
  const codeKind = item.finding.kind === "malformed_code" || item.finding.kind === "nonexistent_code";
  const parts = codeKind ? fix.split(/\s*,\s*/) : [fix];
  return (
    <p className="text-small text-ink2 mt-1">
      {"→ Proposed: "}
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 ? " · " : null}
          <CodeChip>{p}</CodeChip>
        </span>
      ))}
    </p>
  );
}

function What({ item, report }: { item: ErrorItem; report: Report }) {
  if (item.finding.kind === "unit_conflict") {
    return (
      <p>
        {"The sheet says "}
        <strong>{report.unit.as_written}</strong>
        {"; every filename says "}
        <strong>{report.unit.filenames_say ?? "something else"}</strong>
      </p>
    );
  }
  return (
    <>
      <p>
        <CodeChip>{item.finding.original_text}</CodeChip> {FINDING_SENTENCE[item.finding.kind]}
      </p>
      <Proposed item={item} />
    </>
  );
}

function ActionCell({ item, report, canEdit, status, actions, firstId }: Props & { item: ErrorItem; firstId: string | null }) {
  const [editing, setEditing] = useState(false);
  const f = item.finding;
  const st = status[f.finding_id];
  const isUnit = f.kind === "unit_conflict";
  const confirmed = f.choice.source === "confirmed";

  if (confirmed) {
    return (
      <>
        <ConfirmedLine
          by={f.choice.by}
          at={f.choice.at}
          canEdit={canEdit}
          undoLabel={`Undo confirmation for ${item.name}`}
          targetId={f.finding_id}
          actions={actions}
        />
        <FailureLine status={st} targetId={f.finding_id} actions={actions} />
      </>
    );
  }
  if (!canEdit) return <span className="text-small text-ink2">Not confirmed</span>;
  if (editing) {
    return (
      <FixEditor
        label={`Corrected code for ${item.name}`}
        initial={f.proposed_fix ?? f.original_text}
        serverError={st?.phase === "failed" && st.request.kind === "edit_fix" ? st.message : null}
        onSave={(value) => actions.choose({ target_id: f.finding_id, kind: "edit_fix", value })}
        onCancel={() => setEditing(false)}
      />
    );
  }
  const req = isUnit
    ? ({ target_id: f.finding_id, kind: "confirm_unit", value: report.unit.as_written } as const)
    : ({ target_id: f.finding_id, kind: "confirm_fix", value: f.proposed_fix } as const);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={st?.phase === "saving"}
          aria-label={isUnit ? `Confirm ${report.unit.as_written} for the unit` : `Confirm fix for ${item.name}`}
          {...(f.finding_id === firstId ? { "data-first-unconfirmed": "" } : {})}
          onClick={() => void actions.choose(req)}
        >
          Confirm
        </Button>
        {isUnit ? null : (
          <Button variant="ghost" size="sm" aria-label={`Edit fix for ${item.name}`} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      <FailureLine status={st} targetId={f.finding_id} actions={actions} />
    </>
  );
}

export function ErrorsSection(props: Props) {
  const items = errorItems(props.report);
  const first = items.find((i) => i.finding.choice.source !== "confirmed");
  return (
    <section aria-labelledby="errors-h" className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-danger">
          <Glyph shape="octagon-bar" />
        </span>
        <h2 id="errors-h" className="text-title-sm text-ink font-semibold">
          Errors
        </h2>
        <CountBadge count={props.report.counts.errors} />
        <span aria-hidden="true" className="text-small text-ink2 ml-auto">
          {headingCopy(props.report.counts)}
        </span>
      </div>
      {items.length === 0 ? null : (
        <Table caption="Errors to confirm">
          <Thead>
            <Tr>
              <Th numeric>#</Th>
              <Th>Where</Th>
              <Th>What</Th>
              <Th>Action</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((item, i) => (
              <Tr key={item.finding.finding_id}>
                <Td numeric>
                  <CountBadge count={i + 1} />
                </Td>
                <Td>{item.where}</Td>
                <Td>
                  <What item={item} report={props.report} />
                </Td>
                <Td>
                  <ActionCell {...props} item={item} firstId={first?.finding.finding_id ?? null} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </section>
  );
}
