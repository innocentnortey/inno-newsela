import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { FRONT, recorded } from "./standards-view.ts";

export const standard_confirmation_rule: CheckRule = {
  kind: "standard_confirmation",
  level: "confirmation",
  run: (ctx) => {
    const address = FRONT(ctx);
    return recorded(ctx)
      .filter(
        (s) =>
          (s.origin === "narrowed" || s.origin === "added") &&
          s.confirmation !== "confirmed" &&
          !ctx.confirmations.some((c) => c.code === s.code && c.confirmed_by !== null),
      )
      .map((s) =>
        make_finding(
          "standard_confirmation",
          "confirmation",
          `Standard ${s.code} (${s.origin}) needs a named reviewer to confirm or remove it at ${address} (standard_confirmation)`,
          { address, code: s.code },
        ),
      );
  },
};
