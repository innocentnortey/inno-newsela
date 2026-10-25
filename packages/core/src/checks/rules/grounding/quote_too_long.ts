import type { CheckRule } from "../../types.ts";
import { node_text } from "../structural/doc-walk.ts";
import { collect } from "./fields.ts";
import { make_finding } from "./finding.ts";
import { count_words } from "./text.ts";

export const quote_too_long_rule: CheckRule = {
  kind: "quote_too_long",
  level: "blocking",
  run: (ctx, policy) =>
    collect(ctx)
      .quotes.filter(
        ({ node }) =>
          node.attrs?.rights === "short-quote-commentary" &&
          count_words(node_text(node)) > policy.reviewer_quote_max_words,
      )
      .map(({ address }) =>
        make_finding("quote_too_long", "blocking", "Short quote is over the word limit", address),
      ),
};
