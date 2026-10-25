"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Glyph } from "@/components/ui/glyph";
import { okRowLabel, okRows, type Report } from "./report-model";

export function OkRows({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rows = okRows(report);
  if (rows.length === 0) return null;
  return (
    <section className="mt-8" aria-label="OK rows">
      <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {`${open ? "Hide" : "Show"} ${rows.length} OK rows`}
      </Button>
      <ul id={id} hidden={!open} className="mt-2 flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.row_number} className="bg-success-tint text-small text-ink flex items-center gap-2 rounded-md px-3 py-1.5">
            <span className="text-success">
              <Glyph shape="circle-check" />
            </span>
            {okRowLabel(r)}
          </li>
        ))}
      </ul>
    </section>
  );
}
