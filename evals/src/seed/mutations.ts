// NL-92: pure plant mutations. Each plant is applied to a COPY of a stored lesson; nothing here reads or writes a store.
import { InvariantViolation } from "@ls/core/errors";
import type { CheckKind } from "@ls/core/ports/common";
import type { PMNode, StoredLesson } from "@ls/schema/lesson";

export const PLANT_KINDS = ["wrong_standard_code", "invented_quote", "page_out_of_range", "safety_in_student_block", "missing_section"] as const;
export type PlantKind = (typeof PLANT_KINDS)[number];

export interface Plant {
  plant_id: string;
  lesson_id: string; // the NEW lesson in the seeded unit
  source_lesson_id: string; // the generated lesson that is copied
  kind: PlantKind;
  locator: string; // a section address, or the standard code to replace
  marker: string; // the planted text (for missing_section: the removed section's name)
}

// The check kinds that would raise this plant on the planted hash.
export const KIND_CHECKS: Record<PlantKind, readonly CheckKind[]> = {
  wrong_standard_code: ["code_not_allowed", "standard_not_taught"],
  invented_quote: ["quote_unmatched"],
  page_out_of_range: ["page_out_of_range"],
  safety_in_student_block: ["safety_text_in_student_block"],
  missing_section: ["section_missing"],
};

function paragraph(text: string): PMNode {
  return { type: "paragraph", attrs: { align: null }, content: [{ type: "text", text }] };
}

const apply_wrong_code = (l: StoredLesson, p: Plant): StoredLesson => {
  const standards = l.front_matter.standards;
  const i = Math.max(0, standards.findIndex((s) => s.code === p.locator));
  const target = standards[i];
  if (target === undefined) throw new InvariantViolation("plant target missing", { kind: p.kind });
  standards[i] = { ...target, code: p.marker };
  return l;
};

const append_text = (l: StoredLesson, p: Plant): StoredLesson => {
  const section = l.sections.find((s) => s.address === p.locator);
  if (section === undefined) throw new InvariantViolation("plant target missing", { kind: p.kind });
  section.content = { ...section.content, content: [...(section.content.content ?? []), paragraph(p.marker)] };
  return l;
};

const remove_section = (l: StoredLesson, p: Plant): StoredLesson => {
  if (!l.sections.some((s) => s.address === p.locator)) throw new InvariantViolation("plant target missing", { kind: p.kind });
  l.sections = l.sections.filter((s) => s.address !== p.locator);
  return l;
};

const APPLY: Record<PlantKind, (l: StoredLesson, p: Plant) => StoredLesson> = {
  wrong_standard_code: apply_wrong_code,
  invented_quote: append_text,
  page_out_of_range: append_text,
  safety_in_student_block: append_text,
  missing_section: remove_section,
};

export function apply_plant(lesson: StoredLesson, plant: Plant): StoredLesson {
  const copy = structuredClone(lesson);
  copy.lesson_id = plant.lesson_id;
  return APPLY[plant.kind](copy, plant);
}

function texts(n: PMNode): string[] {
  return [...(n.text !== undefined ? [n.text] : []), ...(n.content ?? []).flatMap(texts)];
}

// True while the planted error is still in this stored version.
export function planted_in(lesson: StoredLesson, plant: Plant): boolean {
  if (plant.kind === "wrong_standard_code") return lesson.front_matter.standards.some((s) => s.code === plant.marker);
  if (plant.kind === "missing_section") return !lesson.sections.some((s) => s.address === plant.locator);
  return lesson.sections.some((sec) => texts(sec.content).some((t) => t.includes(plant.marker)));
}

// What a send-back note must quote to count as naming the plant: the marker, or a number in the marker.
export function naming_hints(plant: Plant): string[] {
  const digits = plant.marker.match(/\d{3,}/g) ?? [];
  return [plant.marker, ...digits].map((h) => h.toLowerCase());
}

// A generic mention of the plant's section: weaker than naming the error, and never counted as caught.
export function section_hints(plant: Plant): string[] {
  return [plant.locator, plant.locator.replace(/_/g, " ")].map((h) => h.toLowerCase());
}
