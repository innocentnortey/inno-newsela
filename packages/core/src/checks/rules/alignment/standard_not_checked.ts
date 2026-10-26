import type { CheckRule } from "../../types.ts";
import { read_evidence } from "./evidence.ts";
import { make_finding } from "./finding.ts";
import { FRONT, assessment_codes, focus_obligations, tag_covers, teaching_parts } from "./standards-view.ts";

export const standard_not_checked_rule: CheckRule = {
  kind: "standard_not_checked",
  level: "blocking",
  run: (ctx) => {
    const checked = assessment_codes(ctx, ["pulse_check", "quick_write"]);
    const address = teaching_parts(ctx.lesson)[0] ?? FRONT(ctx);
    const items = read_evidence(ctx.lesson).filter((e) => e.kind === "assess");
    // A narrowed leaf is reported under the card's listed parent, the code the reviewer sees; one finding per code.
    const missing = focus_obligations(ctx)
      .filter((o) => !checked.has(o.code))
      .map((o) => ({ code: o.parent ?? o.code, leaf: o.code }));
    return [...new Map(missing.map((m) => [m.code, m])).values()].map(({ code, leaf }) => {
      const own = items.filter((e) => e.code === leaf);
      const unsubstantiated = own.find((e) => !e.substantiated);
      const too_broad = own.find((e) => e.substantiated && !tag_covers(ctx, e));
      const message =
        unsubstantiated !== undefined
          ? `Standard ${leaf} is tagged on an item at ${unsubstantiated.address} that has no question or prompt under it (standard_not_checked)`
          : too_broad !== undefined
            ? `Standard ${leaf} is tagged only on an item that names more than two standards, at ${too_broad.address} (standard_not_checked)`
            : `Standard ${leaf} has no Pulse Check or Quick Write tagged with it at ${address} (standard_not_checked)`;
      return make_finding("standard_not_checked", "blocking", message, { address, code });
    });
  },
};
