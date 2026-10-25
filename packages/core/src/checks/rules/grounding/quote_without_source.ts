import type { CheckRule } from "../../types.ts";
import { collect } from "./fields.ts";
import { make_finding } from "./finding.ts";

export const quote_without_source_rule: CheckRule = {
  kind: "quote_without_source",
  level: "blocking",
  run: (ctx) =>
    collect(ctx)
      .quotes.filter(({ node }) => {
        const ref = node.attrs?.source_ref;
        return typeof ref !== "string" || ref.trim() === "";
      })
      .map(({ address }) =>
        make_finding("quote_without_source", "blocking", "Quote has no source", address),
      ),
};
