import type { CheckRule } from "../../types.ts";
import { collect } from "./fields.ts";
import { make_finding } from "./finding.ts";
import { is_excerpt_filled } from "../links/slots.ts";

export const excerpt_slot_open_rule: CheckRule = {
  kind: "excerpt_slot_open",
  level: "blocking",
  // A slot counts as filled only with both a rights status and a source.
  run: (ctx) =>
    collect(ctx)
      .excerpts.filter(({ node }) => !is_excerpt_filled(node.attrs))
      .map(({ address }) =>
        make_finding("excerpt_slot_open", "blocking", "An excerpt is still needed here", address),
      ),
};
