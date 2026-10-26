import type { CheckRule } from "../../types.ts";
import { TEACHING_SECTIONS, read_evidence } from "./evidence.ts";
import { make_finding } from "./finding.ts";
import { FRONT, focus_obligations } from "./standards-view.ts";

export const standard_not_taught_rule: CheckRule = {
  kind: "standard_not_taught",
  level: "blocking",
  run: (ctx) => {
    const address = FRONT(ctx);
    const items = read_evidence(ctx.lesson).filter((e) => e.kind === "teach");
    const in_teaching = (e: (typeof items)[number]): boolean => TEACHING_SECTIONS.includes(e.section);
    // A narrowed leaf is reported under the card's listed parent, the code the reviewer sees; one finding per code.
    const missing = focus_obligations(ctx)
      .filter((o) => !items.some((e) => e.code === o.code && in_teaching(e) && e.substantiated))
      .map((o) => ({ code: o.parent ?? o.code, leaf: o.code }));
    return [...new Map(missing.map((m) => [m.code, m])).values()].map(({ code, leaf }) => {
      const own = items.filter((e) => e.code === leaf);
      const empty = own.find((e) => in_teaching(e));
      const elsewhere = own[0];
      const message =
        empty !== undefined
          ? `Standard ${leaf} is tagged on the routine heading at ${empty.address} but no teaching text follows that heading before the next routine (standard_not_taught)`
          : elsewhere !== undefined
            ? `Standard ${leaf} is tagged only at ${elsewhere.address}, which is not Launch, Literacy Lab or Learning in Action (standard_not_taught)`
            : `Standard ${leaf} has no teaching routine tagged with it at ${address} (standard_not_taught)`;
      return make_finding("standard_not_taught", "blocking", message, { address, code });
    });
  },
};
