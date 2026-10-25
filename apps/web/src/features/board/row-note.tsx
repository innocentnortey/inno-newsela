import { Glyph } from "@/components/ui/glyph";
import { Link } from "@/components/ui/link";
import type { components } from "@/lib/api-types";
import { lessonKeyFromId } from "@/lib/keys";
import type { Role } from "@/lib/roles";
import { runHref } from "./row-href";

type BoardRow = components["schemas"]["BoardRow"];
type SendBackTag = components["schemas"]["SendBackTag"];

const SEND_BACK_LABEL: Record<SendBackTag, string> = {
  standards: "Standards",
  quotes_and_rights: "Quotes and rights",
  eld_support: "ELD support",
  content_safety: "Content safety",
  ai_spans: "AI spans",
  teaching_quality: "Teaching quality",
  other: "Other",
};

function lessonLabel(lessonId: string, fallback: string): string {
  const k = lessonKeyFromId(lessonId);
  if (!k) return fallback;
  if (k.startsWith("L")) return `Lesson ${k.slice(1)}`;
  if (k.startsWith("F")) return `Flex day ${k.slice(1)}`;
  return fallback;
}

export function RowNote({
  row,
  unitKey,
  role,
  runId,
}: {
  row: BoardRow;
  unitKey: string;
  role: Role;
  runId: string | null;
}) {
  const items: React.ReactNode[] = [];
  if (row.state === "generation_failed") {
    items.push(
      <li key="failed" className="flex flex-wrap items-center gap-2">
        <span className="text-danger">Generation failed</span>
        {role === "author" && runId ? <Link href={runHref(unitKey, runId)}>Retry</Link> : null}
      </li>,
    );
  }
  row.dependency_flags.forEach((f, i) => {
    if (f.kind === "waits_on" && f.status === "slot_empty") {
      items.push(<li key={`d${i}`}>{`Waits on ${lessonLabel(f.lesson_id, f.label)}'s excerpt`}</li>);
    } else if (f.kind === "waits_on" && f.status === "waiting_for_source_approval") {
      items.push(<li key={`d${i}`}>{`Waits on ${lessonLabel(f.lesson_id, f.label)}'s approval`}</li>);
    } else if (f.kind === "source_reopened") {
      items.push(
        <li key={`d${i}`} className="flex items-center gap-1">
          <Glyph shape="circle-bang" className="text-warn shrink-0" />
          <span>A lesson this depends on was reopened</span>
        </li>,
      );
    }
  });
  if (row.send_back) {
    items.push(
      <li key="sb" className="flex flex-wrap items-center gap-2">
        <span className="bg-selected text-primary text-label rounded-sm px-1.5">{SEND_BACK_LABEL[row.send_back.tag]}</span>
        <span>{`Changes requested by ${row.send_back.by}`}</span>
      </li>,
    );
  }
  if (row.judge_flag) items.push(<li key="judge">Judge: no · provisional, not expert</li>);
  if (items.length === 0) return <span className="text-ink3">—</span>;
  return <ul className="text-small flex flex-col gap-1">{items}</ul>;
}
