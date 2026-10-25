import type {
  CheckContext,
  CheckFinding,
  CheckRule,
  CoverageCell,
} from "../../types.ts";
import {
  lesson_number,
  opening_routine,
  parse_pages,
  ranges_overlap,
} from "./arc-helpers.ts";

// types.ts CoverageCell has no role yet (plan D2); read it through a local type.
type RoleCell = CoverageCell & { role?: "I" | "P" | "A" };

const base = {
  kind: "arc_repeat",
  level: "advisory",
  span_anchor: null,
  related_lesson_id: null,
  code: null,
} as const satisfies Partial<CheckFinding>;

function repeat_window(ctx: CheckContext): CheckFinding[] {
  const me = lesson_number(ctx.lesson_id);
  const icon = opening_routine(ctx.lesson);
  if (me === null || icon === null) return [];
  const by_n = new Map<number, { id: string; icon: string | null }>();
  for (const d of ctx.linked_lessons) {
    const num = lesson_number(d.lesson_id);
    if (num !== null && num.prefix === me.prefix)
      by_n.set(num.n, { id: d.lesson_id, icon: opening_routine(d.lesson) });
  }
  const prev = by_n.get(me.n - 1);
  const prev2 = by_n.get(me.n - 2);
  if (prev?.icon !== icon || prev2?.icon !== icon) return [];
  return [
    {
      ...base,
      message: `Opens with the same routine (${icon}) as the two lessons before it`,
      address: ctx.lesson.sections[0]?.address ?? `${ctx.lesson_id}.Launch`,
      related_lesson_id: prev.id,
    },
  ];
}

function homework_link(ctx: CheckContext): CheckFinding[] {
  const hw = parse_pages(ctx.row.homework);
  if (hw === null) return [];
  const targets = new Set(
    ctx.links
      .filter(
        (l) =>
          l.from_lesson_id === ctx.lesson_id &&
          (l.kind === "homework_text" || l.kind === "page_continuation"),
      )
      .map((l) => l.to_lesson_id),
  );
  const address =
    ctx.lesson.sections.find((s) => s.name === "Homework")?.address ??
    `${ctx.lesson_id}.Homework`;
  const out: CheckFinding[] = [];
  for (const d of ctx.linked_lessons) {
    if (!targets.has(d.lesson_id)) continue;
    const reading = d.lesson.text_cards.flatMap(
      (c) => parse_pages(c.pages) ?? [],
    );
    if (reading.length === 0 || ranges_overlap(hw, reading)) continue;
    out.push({
      ...base,
      message: `Homework pages do not match the reading in ${d.lesson_id}`,
      address,
      related_lesson_id: d.lesson_id,
    });
  }
  return out;
}

function skill_unpractised(ctx: CheckContext): CheckFinding[] {
  const cells = ctx.unit_coverage as RoleCell[];
  const practised = new Set(
    cells.filter((c) => c.role === "P").map((c) => c.code),
  );
  const codes = new Set(
    cells
      .filter(
        (c) =>
          c.role === "A" &&
          c.lesson_id === ctx.lesson_id &&
          !practised.has(c.code),
      )
      .map((c) => c.code),
  );
  return [...codes].map((code) => ({
    ...base,
    message: `Skill ${code} is assessed here but no lesson in the unit practises it`,
    address: `${ctx.lesson_id}.FrontMatter`,
    code: "skill_unpractised",
  }));
}

export const arc_repeat_rule: CheckRule = {
  kind: "arc_repeat",
  level: "advisory",
  run: (ctx) => [
    ...repeat_window(ctx),
    ...homework_link(ctx),
    ...skill_unpractised(ctx),
  ],
};
