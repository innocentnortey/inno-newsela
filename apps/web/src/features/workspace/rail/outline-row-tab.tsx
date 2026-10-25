import { CodeChip } from "@/components/ui/badge";
import type { components } from "@/lib/api-types";

type Lesson = components["schemas"]["Lesson"];

const KIND_WORD: Record<string, string> = {
  content: "content",
  writer_task: "writer task",
  editor_note: "editor note",
  unit_rule: "unit rule",
  safety_note: "safety note",
};

export function OutlineRowTab({ row }: { row: Lesson["outline_row"] }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-label font-semibold">{`Row ${row.row_number}`}</h3>
      <ul className="flex flex-col gap-2">
        {row.segments.map((s) => (
          <li key={s.segment_id} className="bg-well flex flex-col gap-1 rounded-lg p-3">
            <span className="flex flex-wrap items-center gap-2">
              <CodeChip>{s.column}</CodeChip>
              <span className="text-label">{KIND_WORD[s.kind] ?? s.kind.replaceAll("_", " ")}</span>
              <span className="text-small text-ink2">{s.source === "default" ? "default" : `confirmed by ${s.by ?? "unknown"}`}</span>
              {s.action ? <span className="text-small text-ink2">{s.action.replaceAll("_", " ")}</span> : null}
            </span>
            <p className="text-small">{s.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
