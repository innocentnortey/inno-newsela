import type { StoredLesson } from "@ls/schema/lesson";
import type { UnitId } from "@ls/schema/ids";

export function section_slug(name: string): string {
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w !== "")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/** The one address of a section: `<lesson_id>.<section_slug(name)>`. Every writer and every finding for a section that may not exist uses this. */
export function section_address(lesson_id: string, name: string): string {
  return `${lesson_id}.${section_slug(name)}`;
}

export function normalise_part_label(label: string): string {
  const t = label.trim();
  const letter = /^(?:part\s+)?([A-Za-z])$/i.exec(t);
  if (letter) return `Part ${(letter[1] ?? "").toUpperCase()}`;
  const m = /^part\s+(.*)$/i.exec(t);
  return m ? `Part ${m[1] ?? ""}` : `Part ${t}`;
}

export function part_address(section_address: string, part_label: string): string {
  return `${section_address}.${section_slug(normalise_part_label(part_label))}`;
}

/** Address of the n-th (1-based) safety tip inside a section. Shared with NL-39. */
export function tip_address(section_address: string, ordinal: number): string {
  return `${section_address}.Tip${ordinal}`;
}

/** Id of the n-th (1-based) safety_note segment of a row. Shared with NL-39. */
export function safety_note_id(lesson_id: string, ordinal: number): string {
  return `${lesson_id}.sn${ordinal}`;
}

export function assign_addresses(lesson: StoredLesson, unit_id: UnitId): StoredLesson {
  if (!lesson.lesson_id.startsWith(`${unit_id}.`)) {
    throw new RangeError(`lesson ${lesson.lesson_id} is not in unit ${unit_id}`);
  }
  return {
    ...lesson,
    sections: lesson.sections.map((s) => ({
      ...s,
      address: section_address(lesson.lesson_id, s.name),
    })),
  };
}
