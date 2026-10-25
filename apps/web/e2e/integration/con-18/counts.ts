// NL-115 support: row counts around a refused call (plan 7). A refused move must write nothing.
import { expect } from "@playwright/test";
import { db } from "../support/db";

export interface Counts {
  lesson_version: number;
  review_event: number;
  audit_event: number;
  lesson_metrics: number;
  lesson_doc: number;
  state: string;
  current_version_id: string | null;
}

export async function snapshot(lesson_id: string): Promise<Counts> {
  const d = db();
  const [l] = await d.query<{ state: string; current_version_id: string | null }>("select state, current_version_id from lesson where id = $1", [lesson_id]);
  return {
    lesson_version: await d.count("lesson_version", "lesson_id = $1", [lesson_id]),
    review_event: await d.count("review_event", "lesson_id = $1", [lesson_id]),
    // audit_event is keyed by target; a lesson's rows name it as target_id.
    audit_event: await d.count("audit_event", "target_id = $1", [lesson_id]),
    lesson_metrics: await d.count("lesson_metrics", "lesson_id = $1", [lesson_id]),
    lesson_doc: await d.count("lesson_doc", "lesson_id = $1", [lesson_id]),
    state: l?.state ?? "(missing)",
    current_version_id: l?.current_version_id ?? null,
  };
}

export function expectUnchanged(before: Counts, after: Counts): void {
  expect(after).toEqual(before);
}
