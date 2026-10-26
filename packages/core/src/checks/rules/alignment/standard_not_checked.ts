import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { FRONT, assessment_codes, focus_obligations, teaching_parts } from "./standards-view.ts";

export const standard_not_checked_rule: CheckRule = {
  kind: "standard_not_checked",
  level: "blocking",
  run: (ctx) => {
    const checked = assessment_codes(ctx, ["pulse_check"]);
    const address = teaching_parts(ctx.lesson)[0] ?? FRONT(ctx);
    return focus_obligations(ctx)
      .filter((o) => !checked.has(o.code))
      .map(({ code }) =>
        make_finding(
          "standard_not_checked",
          "blocking",
          `Standard ${code} has no Pulse Check item tagged with it at ${address} (standard_not_checked)`,
          { address, code },
        ),
      );
  },
};
