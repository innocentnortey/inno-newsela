import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { FRONT, focus_codes, teaching_parts } from "./standards-view.ts";

export const standard_not_taught_rule: CheckRule = {
  kind: "standard_not_taught",
  level: "blocking",
  run: (ctx) => {
    const codes = focus_codes(ctx);
    if (codes.length === 0 || teaching_parts(ctx.lesson).length > 0) return [];
    const address = FRONT(ctx);
    return codes.map((code) =>
      make_finding(
        "standard_not_taught",
        "blocking",
        `Standard ${code} has no teaching part at ${address} (standard_not_taught)`,
        { address, code },
      ),
    );
  },
};
