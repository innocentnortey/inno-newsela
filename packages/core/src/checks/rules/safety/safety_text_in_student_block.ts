import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { notes_of } from "./notes.ts";
import { student_blocks } from "./student-blocks.ts";
import { words } from "./words.ts";

function windows(ws: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= ws.length; i += 1) out.push(ws.slice(i, i + n).join(" "));
  return out;
}

export const safety_text_in_student_block_rule: CheckRule = {
  kind: "safety_text_in_student_block",
  level: "blocking",
  run: (ctx, policy) => {
    const n = policy.safety_run_min_words;
    const blocks = student_blocks(ctx.lesson);
    const out = [];
    for (const note of notes_of(ctx)) {
      const nw = words(note.text);
      if (nw.length < n) continue;
      const grams = new Set(windows(nw, n));
      const hit = new Set<string>();
      for (const b of blocks) {
        if (hit.has(b.address)) continue;
        if (windows(words(b.text), n).some((g) => grams.has(g))) {
          hit.add(b.address);
          out.push(
            make_finding(
              "safety_text_in_student_block",
              "blocking",
              `Safety note ${note.id} text appears in a student-facing block at ${b.address} (safety_text_in_student_block)`,
              { address: b.address },
            ),
          );
        }
      }
    }
    return out;
  },
};
