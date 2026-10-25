import type { CheckRule } from "../../types.ts";
import { collect } from "./fields.ts";
import { make_finding } from "./finding.ts";

export const rights_to_clear_rule: CheckRule = {
  kind: "rights_to_clear",
  level: "blocking",
  run: (ctx) => {
    const { quotes, excerpts } = collect(ctx);
    return [...quotes, ...excerpts]
      .filter(({ node }) => node.attrs?.rights === "to-clear")
      .map(({ address }) =>
        make_finding("rights_to_clear", "blocking", "Rights to clear before approval", address),
      );
  },
};
