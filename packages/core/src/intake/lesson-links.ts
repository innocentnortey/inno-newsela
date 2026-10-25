import { createHash } from "node:crypto";
import type { LessonLinkRecord, NormalizedRow } from "@ls/schema/outline";

export interface LinkSource {
  link: LessonLinkRecord;
  /** The homework line that caused the link. */
  line: string;
}

const QUOTED = /[“"]([^”"\n]{3,120})[”"]/;
const PAGES = /\bpp?\.\s*(\d+)\s*[–-]\s*(\d+)/g;

const norm_title = (t: string): string => t.toLowerCase().replace(/\s+/g, " ").trim().replace(/^the /, "");
const hash12 = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 12);

function homework_lines(row: NormalizedRow): string[] {
  return row.homework === null ? [] : row.homework.split("\n").filter((l) => l.trim() !== "");
}

function writer_text(row: NormalizedRow): string {
  return row.segments.filter((s) => s.kind === "writer_task").map((s) => s.text).join("\n");
}

function last_page_end(homework: string): number | null {
  let end: number | null = null;
  for (const m of homework.matchAll(PAGES)) end = Number(m[2]);
  return end;
}

/** Links with the homework line that produced each one (normalize uses the line for its finding). */
export function compute_link_sources(rows: readonly NormalizedRow[]): LinkSource[] {
  const lessons = rows
    .filter((r) => r.kind === "lesson" && r.lesson_id !== null)
    .sort((a, b) => a.row_number - b.row_number);
  const order = new Map(lessons.map((r, i) => [r.row_number, i]));
  const out: Array<LinkSource & { from: number; to: number; rank: number }> = [];
  const targeted = new Set<string>();

  const short = (r: NormalizedRow): string => `Lesson ${r.number ?? "?"}`;
  const make = (
    kind: LessonLinkRecord["kind"],
    a: NormalizedRow,
    b: NormalizedRow,
    slot: string,
    label: string,
    line: string,
  ): void => {
    const from_id = a.lesson_id as NormalizedRow["lesson_id"] & string;
    const to_id = b.lesson_id as NormalizedRow["lesson_id"] & string;
    out.push({
      link: {
        link_id: "lk_" + hash12(`${kind}|${from_id}|${to_id}|${label}`),
        from_lesson_id: from_id,
        from_address: `${from_id}.Homework`,
        to_lesson_id: to_id,
        to_slot_id: slot,
        kind,
        label,
      },
      line,
      from: order.get(a.row_number) ?? 0,
      to: order.get(b.row_number) ?? 0,
      rank: kind === "homework_text" ? 0 : kind === "excerpt_slot" ? 1 : 2,
    });
  };

  for (const a of lessons) {
    const ai = order.get(a.row_number) ?? 0;
    for (const line of homework_lines(a)) {
      const q = QUOTED.exec(line);
      if (q) {
        const title = norm_title(q[1] as string);
        const hits = lessons.filter((b) => {
          if (b === a) return false;
          const hay = `${b.text_set ?? ""}\n${writer_text(b)}`.toLowerCase().replace(/\s+/g, " ");
          return hay.includes(title);
        });
        const later = hits.find((b) => (order.get(b.row_number) ?? 0) > ai);
        const earlier = [...hits].reverse().find((b) => (order.get(b.row_number) ?? 0) < ai);
        const b = later ?? earlier;
        if (b) {
          targeted.add(b.lesson_id as string);
          make(
            "homework_text",
            a,
            b,
            `${b.lesson_id}.excerpt-1`,
            `${short(a)} Homework → ${short(b)} excerpt slot (“${q[1]}”)`,
            line,
          );
        }
      } else if (/\b(excerpt|passage|text)\b/i.test(line)) {
        const b = lessons.find(
          (c) => (order.get(c.row_number) ?? 0) > ai && !targeted.has(c.lesson_id as string) && writer_text(c) !== "",
        );
        if (b) {
          targeted.add(b.lesson_id as string);
          make("excerpt_slot", a, b, `${b.lesson_id}.excerpt-1`, `${short(a)} Homework → ${short(b)} excerpt slot`, line);
        }
      }
    }
    const end = a.homework === null ? null : last_page_end(a.homework);
    const next = lessons[ai + 1];
    if (end !== null && next && next.pages !== null) {
      const start = Number(/^\d+/.exec(next.pages)?.[0]);
      if (start === end + 1) {
        make(
          "page_continuation",
          a,
          next,
          `${next.lesson_id}.pages`,
          `${short(a)} Homework pp. … ${end} → ${short(next)} focus pp. ${next.pages}`,
          a.homework ?? "",
        );
      }
    }
  }
  return out
    .sort((x, y) => x.from - y.from || x.rank - y.rank || x.to - y.to)
    .map(({ link, line }) => ({ link, line }));
}

export function compute_lesson_links(rows: readonly NormalizedRow[]): LessonLinkRecord[] {
  return compute_link_sources(rows).map((s) => s.link);
}
