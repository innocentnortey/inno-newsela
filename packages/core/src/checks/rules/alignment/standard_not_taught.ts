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
    // A narrowed leaf is reported under the card's listed parent, the code the reviewer sees; one finding per code.
    const missing = focus_obligations(ctx)
      .filter((o) => !taught.has(o.code))
      .map((o) => ({ code: o.parent ?? o.code, leaf: o.code }));
    return [...new Map(missing.map((m) => [m.code, m])).values()].map(({ code, leaf }) =>
      make_finding(
        "standard_not_taught",
        "blocking",
        `Standard ${leaf} has no teaching routine tagged with it at ${address} (standard_not_taught)`,
        { address, code },
      ),
    );
  },
};
