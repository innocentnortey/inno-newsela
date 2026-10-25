import type { CheckRule } from "../../types.ts";
import { cross_lesson_link_rule } from "./cross_lesson_link.ts";
import { linked_text_changed_rule } from "./linked_text_changed.ts";
import { suggestion_pending_rule } from "./suggestion_pending.ts";

export const RULES: readonly CheckRule[] = [
  cross_lesson_link_rule,
  linked_text_changed_rule,
  suggestion_pending_rule,
];
