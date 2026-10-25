import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { FRONT, cfu_tags, covered, focus_codes, recorded, teaching_parts } from "./standards-view.ts";

export const standard_not_checked_rule: CheckRule = {
  kind: "standard_not_checked",
  level: "blocking",
  run: (ctx) => {
    const tags = cfu_tags(ctx);
    const rec = new Set(recorded(ctx).map((s) => s.code));
    const address = teaching_parts(ctx.lesson)[0] ?? FRONT(ctx);
    return focus_codes(ctx)
      .filter((f) => !covered(f, tags, rec))
      .map((code) =>
        make_finding(
          "standard_not_checked",
          "blocking",
          `Standard ${code} has no Pulse Check item tagged with it at ${address} (standard_not_checked)`,
          { address, code },
        ),
      );
  },
};
