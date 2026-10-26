import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { FRONT, doc_tags, focus_obligations, teaching_addresses } from "./standards-view.ts";

export const standard_not_taught_rule: CheckRule = {
  kind: "standard_not_taught",
  level: "blocking",
  run: (ctx) => {
    const address = FRONT(ctx);
    const where = teaching_addresses(ctx.lesson);
    const taught = new Set(
      doc_tags(ctx.lesson)
        .filter((t) => t.kind === "teach" && where.has(t.address))
        .map((t) => t.code),
    );
    return focus_obligations(ctx)
      .filter((o) => !taught.has(o.code))
      .map(({ code }) =>
        make_finding(
          "standard_not_taught",
          "blocking",
          `Standard ${code} has no teaching routine tagged with it at ${address} (standard_not_taught)`,
          { address, code },
        ),
      );
  },
};
