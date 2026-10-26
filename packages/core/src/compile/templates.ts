import type { DraftRole } from "@ls/schema/lesson-draft";

export interface SectionSlot {
  name: string;
  minutes: number;
  required_roles: readonly DraftRole[];
  /** Exact part labels every block of this section carries (WP-1/WP-2: Part A, Part B). */
  parts?: readonly string[];
  /**
   * Roles each part must hold (WP-1/WP-2 table B, Learning in Action Part A and Part B). Keys are labels from `parts`.
   * The prompt prints them (render.ts template_block) so the model is told the worked-pair list. The structural check
   * still enforces only the section-level `required_roles` (a per-part check would block lessons that pass today).
   */
  part_roles?: Readonly<Record<string, readonly DraftRole[]>>;
  /**
   * Placeholder role a part is expected to hold (the lesson-shape placeholder policy: WP-1 Part A text_evidence_needed,
   * WP-2 and WP-4 Part A excerpt_slot). Printed for the model; not enforced per part, because whether a lesson needs a
   * quotation is a property of the row (the excerpt-slot obligation check owns the Writing case).
   */
  part_placeholder?: Readonly<Record<string, DraftRole>>;
}
export interface SectionTemplate {
  lesson_type: string;
  sections: readonly SectionSlot[];
}

const slot = (
  name: string,
  minutes: number,
  required_roles: readonly DraftRole[],
  parts?: readonly string[],
  extra?: Pick<SectionSlot, "part_roles" | "part_placeholder">,
): SectionSlot => ({
  name,
  minutes,
  required_roles,
  ...(parts !== undefined ? { parts } : {}),
  ...(extra ?? {}),
});

// Learning in Action routine headings are not required (WP-1/WP-2 table B list none). Part A/Part B are required for
// Reading and Writing only (WP-1, WP-2); Academic Discussion, Research and Presentation have no worked pair, so no parts.
// Part A / Part B roles per lesson kind, oracle WP-1 (Reading) and WP-2 (Writing) "Required output B" tables and the S3
// expected.json files that restate them. Reading Part A: teacher_talk + support_table, and the lesson's one
// text_evidence_needed; Writing Part A: support_table, and the one excerpt_slot; Part B: cfu_item + support_table.
const PART_ROLES = {
  Reading: {
    part_roles: { "Part A": ["teacher_talk", "support_table"], "Part B": ["cfu_item", "support_table"] },
    part_placeholder: { "Part A": "text_evidence_needed" },
  },
  Writing: {
    part_roles: { "Part A": ["support_table"], "Part B": ["cfu_item", "support_table"] },
    part_placeholder: { "Part A": "excerpt_slot" },
  },
} as const satisfies Record<string, Pick<SectionSlot, "part_roles" | "part_placeholder">>;

const five = (lesson_type: string, opts: { parts: boolean }): SectionTemplate => ({
  lesson_type,
  sections: [
    slot("Launch", 5, ["routine_heading", "teacher_talk", "sample_response"]),
    slot("Literacy Lab", 10, [
      "routine_heading", "cfu_item", "callout_purpose", "callout_say", "callout_watch", "support_table",
    ]),
    slot(
      "Learning in Action",
      30,
      ["teacher_talk", "cfu_item", "callout_purpose", "callout_say", "callout_watch", "support_table"],
      opts.parts ? ["Part A", "Part B"] : undefined,
      opts.parts ? (lesson_type === "Reading" ? PART_ROLES.Reading : PART_ROLES.Writing) : undefined,
    ),
    slot("Look Back", 5, ["quick_write", "sample_response"]),
    slot("Homework", 0, ["homework"]),
  ],
});

// Every "Learning in Action" needs the three ELD callouts and a Pulse Check, whatever the lesson type; the structural
// checks read this template (checks/rules/structural/section_missing.ts).
const LIA_ROLES = ["teacher_talk", "cfu_item", "callout_purpose", "callout_say", "callout_watch"] as const;

// WP-3: the Flex Day Launch has a sample response; Learning in Action has a routine heading and a teacher tip.
const FLEX_LIA_ROLES = [...LIA_ROLES, "routine_heading", "teacher_tip"] as const;

const flex = (lesson_type: string): SectionTemplate => ({
  lesson_type,
  sections: [
    slot("Launch", 5, ["routine_heading", "teacher_talk", "sample_response"]),
    slot("Learning in Action", 40, FLEX_LIA_ROLES),
    slot("Look Back", 5, ["quick_write"]),
  ],
});

export const SECTION_TEMPLATES: { templates: readonly SectionTemplate[] } = {
  templates: [
    five("Reading", { parts: true }),
    five("Writing", { parts: true }),
    five("Academic Discussion", { parts: false }),
    five("Research", { parts: false }),
    five("Presentation", { parts: false }),
    {
      lesson_type: "Spark",
      sections: [
        slot("Launch", 15, ["routine_heading", "teacher_talk", "sample_response"]),
        slot("Learning in Action", 30, LIA_ROLES),
        slot("Look Back", 5, ["quick_write"]),
        slot("Homework", 0, ["homework"]),
      ],
    },
    flex("Flex Day"),
    flex("Assessment"),
  ],
};

export function template_for(lesson_type: string): SectionTemplate | undefined {
  return SECTION_TEMPLATES.templates.find((t) => t.lesson_type === lesson_type);
}

// Tolerances. The lesson total (50 plus or minus 5) is `CHECK_POLICY.minutes_target` / `minutes_tolerance` in
// checks/policy.ts. S3's section tolerance of 5 (evals/src/suites/s3-assertions.ts) measures a coarser first-output
// shape on the compiled lesson and is NOT equivalent to the blocking check below.

/** The draft prompt asks for block minutes that add up exactly to the section's minutes (locked lesson-shape.md). */
export const SECTION_MINUTES_PROMPT_TOLERANCE = 0;
/** Blocking `minutes_out_of_range` check, per stored section: |stored - template| above this blocks. A 3-minute Look Back (template 5) must flag. */
export const SECTION_MINUTES_CHECK_TOLERANCE = 1;
