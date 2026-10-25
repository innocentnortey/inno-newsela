import type { CheckFinding, CheckRule } from "../../types.ts";
import { collect } from "./fields.ts";
import { make_finding } from "./finding.ts";
import { build_sources } from "./sources.ts";
import { count_words, find_quote_spans, normalize_for_match } from "./text.ts";

export const quote_unmatched_rule: CheckRule = {
  kind: "quote_unmatched",
  level: "blocking",
  run: (ctx, policy) => {
    const hay = normalize_for_match(build_sources(ctx).texts.join("\n"));
    const out: CheckFinding[] = [];
    for (const field of collect(ctx).fields) {
      for (const span of find_quote_spans(field.text)) {
        const words = count_words(span.inner);
        if (words < policy.quote_span_min_words) continue;
        if (/_{2,}/.test(span.inner)) continue; // a fill-in blank, not a quotation
        if (hay.includes(normalize_for_match(span.inner))) continue;
        out.push(
          make_finding(
            "quote_unmatched",
            "blocking",
            `Quoted passage of ${words} words is not in this lesson's outline row, arc header, text cards or standards`,
            field.address,
          ),
        );
      }
    }
    return out;
  },
};
