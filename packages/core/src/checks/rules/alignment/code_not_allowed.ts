import type { CheckContext, CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { read_evidence } from "./evidence.ts";
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
    const row_listed = new Set([...ctx.row.focus_codes, ...ctx.row.eld_codes, ...ctx.row.msls_codes]);
    const address = FRONT(ctx);
    const out = [];
    const recorded_codes = new Set<string>();
    // Row-listed codes are valid at any level; a recorded leaf of a listed parent is a narrowing; added codes only
    // when the row lists none in that set. Anything else, including the parent of a listed leaf, is blocked.
    for (const s of recorded(ctx)) {
      recorded_codes.add(s.code);
      const std = ctx.standards.find((x) => x.code === s.code);
      const ok =
        std !== undefined &&
        (listed.has(s.code) ||
          (std.is_leaf && std.parent_code !== null && listed.has(std.parent_code)) ||
          (s.origin === "added" && row_list_empty(ctx, std.set)));
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
    // Every tagged code is judged against the official standards. A missing lookup never means valid: only a code the
    // pinned row itself lists may lack a catalogue row (the row is validated at intake).
    const first_address = new Map<string, string>();
    for (const e of read_evidence(ctx.lesson)) if (!first_address.has(e.code)) first_address.set(e.code, e.address);
    for (const [code, where] of first_address) {
      if (recorded_codes.has(code)) continue;
      const std = ctx.standards.find((x) => x.code === code);
      if (std === undefined) {
        if (row_listed.has(code)) continue;
        out.push(
          make_finding(
            "code_not_allowed",
            "blocking",
            `Code ${code} is used in a heading but is not in the official standards list; correct or remove the tag at ${where} (code_not_allowed)`,
            { address: where, code },
          ),
        );
        continue;
      }
      if (listed.has(code)) continue;
      // An unrecorded leaf of a listed parent is the advisory standard_add_suggestion case, not a block.
      if (std.is_leaf && std.parent_code !== null && listed.has(std.parent_code)) continue;
      out.push(
        make_finding(
          "code_not_allowed",
          "blocking",
          `Code ${code} is used in a heading but is not one of this lesson's standards; remove the tag at ${where} (code_not_allowed)`,
          { address: where, code },
        ),
      );
    }
    return out;
  },
};
