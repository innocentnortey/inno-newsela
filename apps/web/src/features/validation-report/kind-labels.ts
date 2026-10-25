import type { Finding } from "./report-model";

/** One plain sentence per finding kind. The record type makes TypeScript force completeness. */
export const FINDING_SENTENCE: Record<Finding["kind"], string> = {
  malformed_code: "has a code that is not written correctly",
  nonexistent_code: "does not exist",
  unit_conflict: "The sheet and the filenames name different units",
  duplicate_id: "has an id that appears more than once",
  missing_required_column: "is missing a required column",
  parent_code: "uses a parent code where a specific one is expected",
  bad_filename: "has a filename that does not match the unit",
  eld_mismatch: "ELD label does not match its strand",
  eld_not_checked: "ELD label was not checked",
  vocabulary_over_cap: "Over the vocabulary cap",
  vocabulary_word_missing: "A vocabulary word is missing from the lesson text",
  homework_links_later_row: "Homework points at a later row",
  non_breaking_space: "Contains a non-breaking space",
  duplicate_text: "Repeats text from another row",
  instruction_shaped: "Instruction-shaped text, kept as content",
  safety_note_proposed: "Possible safety note",
  writer_task: "Writer task",
};
