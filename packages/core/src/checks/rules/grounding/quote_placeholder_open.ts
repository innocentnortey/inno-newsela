import type { CheckRule } from "../../types.ts";
import { collect } from "./fields.ts";
import { make_finding } from "./finding.ts";

export const quote_placeholder_open_rule: CheckRule = {
  kind: "quote_placeholder_open",
  level: "blocking",
  // A placeholder node that still exists is open: filling it replaces the node.
  run: (ctx) =>
    collect(ctx).placeholders.map(({ address }) =>
      make_finding("quote_placeholder_open", "blocking", "A quote is still needed here", address),
    ),
};
