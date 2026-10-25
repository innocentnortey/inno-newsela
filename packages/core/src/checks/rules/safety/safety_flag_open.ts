import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";

export const safety_flag_open_rule: CheckRule = {
  kind: "safety_flag_open",
  level: "blocking",
  run: (ctx) =>
    ctx.safety_flags
      .filter((f) => f.status === "open")
      .map((f) =>
        make_finding(
          "safety_flag_open",
          "blocking",
          `Safety note ${f.flag_id} is open: a named reviewer must clear it (tip at ${f.teacher_tip_address ?? "none"}) (safety_flag_open)`,
          { address: f.teacher_tip_address },
        ),
      ),
};
