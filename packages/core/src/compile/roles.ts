import type { DraftRole } from "@ls/schema/lesson-draft";

const NOT_IN: Partial<Record<DraftRole, readonly string[]>> = {
  callout_purpose: ["Launch", "Look Back", "Homework"],
  callout_say: ["Launch", "Look Back", "Homework"],
  callout_watch: ["Launch", "Look Back", "Homework"],
  support_table: ["Launch", "Look Back", "Homework"],
};

export function check_role(role: DraftRole, section_name: string): "ok" | "role_not_allowed" {
  if (role === "homework") return section_name === "Homework" ? "ok" : "role_not_allowed";
  return NOT_IN[role]?.includes(section_name) ? "role_not_allowed" : "ok";
}
