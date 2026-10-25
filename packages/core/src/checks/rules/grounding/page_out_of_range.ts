import type { CheckFinding, CheckRule } from "../../types.ts";
import { collect } from "./fields.ts";
import { make_finding } from "./finding.ts";
import { extract_refs, ref_in_range } from "./page-refs.ts";
import { build_sources } from "./sources.ts";

export const page_out_of_range_rule: CheckRule = {
  kind: "page_out_of_range",
  level: "blocking",
  run: (ctx) => {
    const { ranges } = build_sources(ctx);
    const out: CheckFinding[] = [];
    for (const field of collect(ctx).fields) {
      for (const ref of extract_refs(field.text)) {
        if (ref_in_range(ref, ranges[ref.kind])) continue;
        out.push(
          make_finding(
            "page_out_of_range",
            "blocking",
            "Page or chapter reference is outside the range the outline row gives",
            field.address,
          ),
        );
      }
    }
    return out;
  },
};
