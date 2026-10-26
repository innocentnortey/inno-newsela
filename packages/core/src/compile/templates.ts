import type { DraftRole } from "@ls/schema/lesson-draft";

export interface SectionSlot {
  name: string;
  minutes: number;
  required_roles: readonly DraftRole[];
  /** Exact part labels every block of this section carries (WP-1/WP-2: Part A, Part B). */
  parts?: readonly string[];
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
): SectionSlot => ({
  name,
  minutes,
  required_roles,
  ...(parts !== undefined ? { parts } : {}),
});

const five = (lesson_type: string): SectionTemplate => ({
  lesson_type,
  sections: [
    slot("Launch", 5, ["routine_heading", "teacher_talk", "sample_response"]),
    slot("Literacy Lab", 10, [
      "routine_heading", "cfu_item", "callout_purpose", "callout_say", "callout_watch", "support_table",
    ]),
    slot(
      "Learning in Action",
      30,
      ["routine_heading", "teacher_talk", "cfu_item", "callout_purpose", "callout_say", "callout_watch", "support_table"],
      ["Part A", "Part B"],
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
    five("Reading"),
    five("Writing"),
    five("Academic Discussion"),
    five("Research"),
    five("Presentation"),
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
