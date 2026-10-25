import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { FRONT, recorded } from "./standards-view.ts";

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

export const eld_label_mismatch_rule: CheckRule = {
  kind: "eld_label_mismatch",
  level: "advisory",
  run: (ctx) => {
    const address = FRONT(ctx);
    const out = [];
    for (const s of recorded(ctx)) {
      if (s.role !== "eld" || norm(s.official_text) === "") continue;
      const r = ctx.standards.find((x) => x.code === s.code);
      if (r === undefined || r.eld_strand === null) continue;
      const o = ctx.standards.find(
        (x) => x.code !== s.code && norm(x.text) === norm(s.official_text),
      );
      if (o !== undefined && o.eld_strand !== null && o.eld_strand !== r.eld_strand) {
        out.push(
          make_finding(
            "eld_label_mismatch",
            "advisory",
            `ELD code ${s.code} carries a label from another strand at ${address} (eld_label_mismatch)`,
            { address, code: s.code },
          ),
        );
      }
    }
    return out;
  },
};
