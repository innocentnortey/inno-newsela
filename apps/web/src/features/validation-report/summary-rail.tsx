"use client";

import { useId } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { eldSummary, gateBanner, type Report } from "./report-model";

export function SummaryRail({
  report,
  canEdit,
  generating,
  onGenerate,
}: {
  report: Report;
  canEdit: boolean;
  generating: boolean;
  onGenerate(): void;
}) {
  const gateId = useId();
  const c = report.counts;
  const gate = gateBanner(report);
  const allowed = report.generate_allowed;
  const rows: [string, number][] = [
    ["Teaching days", c.teaching_days],
    ["Errors to confirm", c.errors_unconfirmed],
    ["Warnings", c.warnings],
    ["ELD labels flagged", eldSummary(report).flagged],
    ["ELD findings", c.eld_mismatches],
    ["Bad filenames", c.bad_filenames],
  ];
  return (
    <div className="flex flex-col gap-4">
      <Card title="Summary">
        <dl className="text-small grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink2">{k}</dt>
              <dd className="text-ink text-right tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div id={gateId}>
        <Banner level={gate.level} title={gate.title}>
          {gate.body}
        </Banner>
      </div>
      {canEdit ? (
        <Button
          variant={allowed ? "primary" : "secondary"}
          size="lg"
          className="w-full"
          disabled={!allowed}
          aria-describedby={gateId}
          loading={generating}
          onClick={onGenerate}
        >
          {`Generate ${c.teaching_days} lessons`}
        </Button>
      ) : null}
    </div>
  );
}
