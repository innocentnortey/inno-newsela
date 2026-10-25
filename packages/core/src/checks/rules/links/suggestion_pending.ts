import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";

export const suggestion_pending_rule: CheckRule = {
  kind: "suggestion_pending",
  level: "blocking",
  run: (ctx) =>
    ctx.pending_suggestions
      .filter((s) => s.status === "pending")
      .map((s) =>
        make_finding(
          "suggestion_pending",
          "blocking",
          `Pending AI suggestion ${s.suggestion_id} needs a named person's decision (suggestion_pending)`,
          { span_anchor: `${s.anchor_start}:${s.anchor_end}` },
        ),
      ),
};
