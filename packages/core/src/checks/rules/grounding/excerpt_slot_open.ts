import type { CheckRule } from "../../types.ts";
import { collect } from "./fields.ts";
import { make_finding } from "./finding.ts";

export const excerpt_slot_open_rule: CheckRule = {
  kind: "excerpt_slot_open",
  level: "blocking",
  // A slot counts as filled only with both a rights status and a source.
  run: (ctx) =>
    collect(ctx)
      .excerpts.filter(({ node }) => {
        const ref = node.attrs?.source_ref;
        return (
          node.attrs?.rights === "unset" ||
          typeof ref !== "string" ||
          ref.trim() === ""
        );
      })
      .map(({ address }) =>
        make_finding("excerpt_slot_open", "blocking", "An excerpt is still needed here", address),
      ),
};
