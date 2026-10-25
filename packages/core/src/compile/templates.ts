import type { DraftRole } from "@ls/schema/lesson-draft";

export interface SectionSlot {
  name: string;
  minutes: number;
  required_roles: readonly DraftRole[];
}
export interface SectionTemplate {
  lesson_type: string;
  sections: readonly SectionSlot[];
}

const slot = (name: string, minutes: number, required_roles: readonly DraftRole[]): SectionSlot => ({
  name,
  minutes,
  required_roles,
});

const five = (lesson_type: string): SectionTemplate => ({
  lesson_type,
  sections: [
    slot("Launch", 5, ["routine_heading", "teacher_talk", "sample_response"]),
    slot("Literacy Lab", 10, [
      "routine_heading", "cfu_item", "callout_purpose", "callout_say", "callout_watch", "support_table",
    ]),
    slot("Learning in Action", 30, [
      "teacher_talk", "cfu_item", "callout_purpose", "callout_say", "callout_watch", "support_table",
    ]),
    slot("Look Back", 5, ["quick_write", "sample_response"]),
    slot("Homework", 0, ["homework"]),
  ],
});

const flex = (lesson_type: string): SectionTemplate => ({
  lesson_type,
  sections: [
    slot("Launch", 5, ["routine_heading", "teacher_talk"]),
    slot("Learning in Action", 40, ["teacher_talk", "cfu_item"]),
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
        slot("Learning in Action", 30, ["teacher_talk", "cfu_item"]),
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
