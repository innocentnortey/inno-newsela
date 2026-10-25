"use client";

import { Button } from "@/components/ui/button";
import { CodeChip } from "@/components/ui/badge";
import { Glyph } from "@/components/ui/glyph";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { ConfirmedLine, FailureLine } from "./confirmed-line";
import { FINDING_SENTENCE } from "./kind-labels";
import { SegmentedRadio } from "./segmented-radio";
import {
  flaggedEld,
  eldSummary,
  lessonNumber,
  rowsLabel,
  warningItems,
  type EldItem,
  type Report,
  type ReportActions,
  type Row,
  type Segment,
  type TargetStatus,
  type WarningItem,
} from "./report-model";

interface Props {
  report: Report;
  canEdit: boolean;
  status: Record<string, TargetStatus>;
  actions: ReportActions;
}

const NOTE_OPTIONS = [
  { value: "apply", label: "Apply" },
  { value: "show_only", label: "Show to reviewer only" },
  { value: "ignore", label: "Ignore" },
];

function whereOf(row: Row, column?: string): string {
  const k = lessonNumber(row.lesson_id);
  const base = row.kind === "lesson" && k ? `Row ${row.row_number} · Lesson ${k}` : `Row ${row.row_number}`;
  return column ? `${base} · Column ${column}` : base;
}

function NoteCell({ row, segment, canEdit, status, actions }: Props & { row: Row; segment: Segment }) {
  const st = status[segment.segment_id];
  const shown = (st?.request.value as string | undefined) ?? segment.action ?? "apply";
  const label = NOTE_OPTIONS.find((o) => o.value === shown)?.label ?? shown;
  return (
    <>
      {canEdit ? (
        <SegmentedRadio
          legend={`Action for row ${row.row_number}, column ${segment.column}`}
          value={shown}
          options={NOTE_OPTIONS}
          onChange={(value) => void actions.choose({ target_id: segment.segment_id, kind: "set_note_action", value })}
        />
      ) : (
        <p>{label}</p>
      )}
      <p className={segment.source === "confirmed" ? "text-small text-ink2 mt-1" : "text-small text-ink3 mt-1"}>
        {segment.source === "confirmed" ? `Changed by ${segment.by ?? "someone"}` : "Default"}
      </p>
      <FailureLine status={st} targetId={segment.segment_id} actions={actions} />
    </>
  );
}

function FindingCell({ row, item, canEdit, status, actions }: Props & { row: Row; item: Extract<WarningItem, { type: "finding" }> }) {
  const f = item.finding;
  const st = status[f.finding_id];
  if (f.kind !== "safety_note_proposed") return <span className="text-small text-ink3">Default</span>;
  if (f.choice.source === "confirmed") {
    return (
      <ConfirmedLine
        by={f.choice.by}
        at={f.choice.at}
        canEdit={canEdit}
        undoLabel={`Undo safety flag for row ${row.row_number}`}
        targetId={f.finding_id}
        actions={actions}
      />
    );
  }
  return (
    <>
      <span className="text-small text-ink3 mr-2">Default</span>
      {canEdit ? (
        <Button
          variant="secondary"
          size="sm"
          loading={st?.phase === "saving"}
          aria-label={`Confirm as a safety flag for row ${row.row_number}`}
          onClick={() => void actions.choose({ target_id: f.finding_id, kind: "confirm_safety_note" })}
        >
          Confirm as a safety flag
        </Button>
      ) : null}
      <FailureLine status={st} targetId={f.finding_id} actions={actions} />
    </>
  );
}

function ItemRow({ item, ...props }: Props & { item: WarningItem }) {
  if (item.type === "unit_rule") {
    return (
      <Tr>
        <Td>{`Rows ${rowsLabel(item.rule.scope_rows)}`}</Td>
        <Td>
          <strong>unit rule</strong> {" for rows "}
          {rowsLabel(item.rule.scope_rows)}: <CodeChip>{item.rule.text}</CodeChip>
        </Td>
        <Td>
          <span className="text-small text-ink3">{item.rule.source === "confirmed" ? "Confirmed" : "Default"}</span>
        </Td>
      </Tr>
    );
  }
  if (item.type === "writer_task") {
    return (
      <Tr>
        <Td>{whereOf(item.row, item.segment.column)}</Td>
        <Td>
          <CodeChip>{item.segment.text}</CodeChip> {"becomes an "}
          <strong>excerpt slot</strong>
        </Td>
        <Td>
          <span className="text-small text-ink3">Default</span>
        </Td>
      </Tr>
    );
  }
  if (item.type === "note") {
    return (
      <Tr>
        <Td>{whereOf(item.row, item.segment.column)}</Td>
        <Td>
          <CodeChip>{item.segment.text}</CodeChip>
        </Td>
        <Td>
          <NoteCell {...props} row={item.row} segment={item.segment} />
        </Td>
      </Tr>
    );
  }
  return (
    <Tr>
      <Td>{whereOf(item.row, item.finding.column)}</Td>
      <Td>
        {item.finding.original_text ? <CodeChip>{item.finding.original_text}</CodeChip> : null} {FINDING_SENTENCE[item.finding.kind]}
      </Td>
      <Td>
        <FindingCell {...props} row={item.row} item={item} />
      </Td>
    </Tr>
  );
}

function EldRow({ item, canEdit, status, actions }: Props & { item: EldItem }) {
  const st = status[item.code];
  const value = st?.request.kind === "eld_remap" ? "remap" : st?.request.kind === "eld_keep" ? "keep" : item.choice;
  const remapLabel = item.suggested_remap ? `Re-map to ${item.suggested_remap}` : "Re-map";
  return (
    <Tr>
      <Td>
        <CodeChip>{item.code}</CodeChip>
        <p className="text-small text-ink2 mt-1">{`Rows ${rowsLabel(item.rows)}`}</p>
      </Td>
      <Td>{item.sheet_label}</Td>
      <Td>{item.official_strand}</Td>
      <Td>
        {canEdit ? (
          <SegmentedRadio
            legend={`ELD label for ${item.code}`}
            value={value}
            options={[
              { value: "keep", label: "Keep" },
              { value: "remap", label: remapLabel },
            ]}
            onChange={(v) =>
              void actions.choose(
                v === "remap"
                  ? { target_id: item.code, kind: "eld_remap", value: item.suggested_remap }
                  : { target_id: item.code, kind: "eld_keep" },
              )
            }
          />
        ) : (
          <p>{value === "remap" ? remapLabel : "Keep"}</p>
        )}
        <p className="text-small text-ink3 mt-1">Default</p>
        <FailureLine status={st} targetId={item.code} actions={actions} />
      </Td>
    </Tr>
  );
}

export function WarningsSection(props: Props) {
  const items = warningItems(props.report);
  const flagged = flaggedEld(props.report);
  const { total } = eldSummary(props.report);
  return (
    <section aria-labelledby="warnings-h" className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-warn">
          <Glyph shape="triangle-bang" />
        </span>
        <h2 id="warnings-h" className="text-title-sm text-ink font-semibold">
          Warnings
        </h2>
        <span className="text-small text-ink2">each shows its default</span>
      </div>
      {items.length > 0 ? (
        <Table caption="Warnings with their defaults" className="text-small">
          <Thead>
            <Tr>
              <Th>Where</Th>
              <Th>What the sheet says</Th>
              <Th>Default</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((item, i) => (
              <ItemRow key={i} item={item} {...props} />
            ))}
          </Tbody>
        </Table>
      ) : null}
      {flagged.length > 0 ? (
        <div className="mt-6">
          <Table caption={`ELD labels: ${flagged.length} of ${total} codes flagged`} className="text-small">
            <Thead>
              <Tr>
                <Th>Code</Th>
                <Th>Sheet says</Th>
                <Th>Official strand</Th>
                <Th>Default</Th>
              </Tr>
            </Thead>
            <Tbody>
              {flagged.map((item) => (
                <EldRow key={item.code} item={item} {...props} />
              ))}
            </Tbody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}
