import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { cfu_tags, listed_codes, recorded } from "./standards-view.ts";

export const standard_add_suggestion_rule: CheckRule = {
  kind: "standard_add_suggestion",
  level: "advisory",
  run: (ctx) => {
    const rec = new Set(recorded(ctx).map((s) => s.code));
    const listed = listed_codes(ctx);
    const seen = new Set<string>();
    const out = [];
    for (const t of cfu_tags(ctx)) {
      if (seen.has(t.code) || rec.has(t.code) || listed.has(t.code)) continue;
      const std = ctx.standards.find((x) => x.code === t.code);
      if (std === undefined || !std.is_leaf) continue;
      if (std.parent_code === null || !listed.has(std.parent_code)) continue;
      seen.add(t.code);
      out.push(
        make_finding(
          "standard_add_suggestion",
          "advisory",
          `Pulse Check names ${t.code}, an unlisted leaf of a listed parent; add it? at ${t.address} (standard_add_suggestion)`,
          { address: t.address, code: t.code },
        ),
      );
    }
    return out;
  },
};
