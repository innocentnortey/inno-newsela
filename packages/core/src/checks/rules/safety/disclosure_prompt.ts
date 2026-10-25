import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { student_blocks } from "./student-blocks.ts";

const PATTERNS = [
  /\ba time (?:when )?you\b/i,
  /\byour own experiences?\b/i,
  /\bhave you ever\b/i,
  /\bin your family\b/i,
];

export const disclosure_prompt_rule: CheckRule = {
  kind: "disclosure_prompt",
  level: "advisory",
  run: (ctx) => {
    const level =
      ctx.safety_flags.some((f) => f.status === "open") || ctx.previous_lesson_flags.length > 0
        ? "blocking"
        : "advisory";
    const out = [];
    for (const b of student_blocks(ctx.lesson)) {
      for (const re of PATTERNS) {
        if (!re.test(b.text)) continue;
        out.push(
          make_finding(
            "disclosure_prompt",
            level,
            `Disclosure-style prompt in a student block at ${b.address} (disclosure_prompt)`,
            { address: b.address },
          ),
        );
      }
    }
    return out;
  },
};
