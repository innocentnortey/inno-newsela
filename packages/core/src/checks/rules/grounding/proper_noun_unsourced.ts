import type { CheckFinding, CheckRule } from "../../types.ts";
import { collect } from "./fields.ts";
import { make_finding } from "./finding.ts";
import { build_name_index, scan_names } from "./name-scan.ts";
import { build_sources } from "./sources.ts";

export const proper_noun_unsourced_rule: CheckRule = {
  kind: "proper_noun_unsourced",
  level: "blocking",
  run: (ctx, policy) => {
    const { fields } = collect(ctx);
    const index = build_name_index(
      build_sources(ctx).texts,
      fields.map((f) => f.text),
    );
    const out: CheckFinding[] = [];
    for (const field of fields) {
      const level =
        policy.name_scan_scope === "blocking_everywhere" || field.in_cfu_choice
          ? "blocking"
          : "advisory";
      for (const name of scan_names(field.text, index)) {
        out.push(
          make_finding(
            "proper_noun_unsourced",
            level,
            "Proper name is not in this lesson's outline row, arc header or standards",
            field.address,
            name,
          ),
        );
      }
    }
    return out;
  },
};
