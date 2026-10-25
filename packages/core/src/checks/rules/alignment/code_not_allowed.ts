import type { CheckContext, CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { FRONT, listed_codes, recorded } from "./standards-view.ts";

function row_list_empty(ctx: CheckContext, set: string): boolean {
  if (set === "CA_CCSS_ELA_6") return ctx.row.focus_codes.length === 0;
  if (set === "CA_ELD_6") return ctx.row.eld_codes.length === 0;
  if (set === "MSLS_6") return ctx.row.msls_codes.length === 0;
  return false;
}

export const code_not_allowed_rule: CheckRule = {
  kind: "code_not_allowed",
  level: "blocking",
  run: (ctx) => {
    const listed = listed_codes(ctx);
    const address = FRONT(ctx);
    const out = [];
    for (const s of recorded(ctx)) {
      const std = ctx.standards.find((x) => x.code === s.code);
      let ok = false;
      if (std !== undefined && std.is_leaf) {
        ok =
          listed.has(s.code) ||
          (std.parent_code !== null && listed.has(std.parent_code)) ||
          (s.origin === "added" && row_list_empty(ctx, std.set));
      }
      if (!ok) {
        out.push(
          make_finding(
            "code_not_allowed",
            "blocking",
            `Code ${s.code} is not allowed for this lesson at ${address} (code_not_allowed)`,
            { address, code: s.code },
          ),
        );
      }
    }
    return out;
  },
};
