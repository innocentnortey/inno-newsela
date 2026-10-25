import type { CheckRule } from "../../types.ts";

export const suggestion_pending_rule: CheckRule = {
  kind: "suggestion_pending",
  level: "blocking",
  run: () => [],
};
