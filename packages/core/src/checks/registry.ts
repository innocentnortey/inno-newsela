import { CHECK_KINDS } from "./types.ts";
import type {
  CheckContext,
  CheckFinding,
  CheckPolicy,
  CheckResult,
  CheckRule,
  CheckRuleList,
} from "./types.ts";
import { RULES as structural } from "./rules/structural/index.ts";
import { RULES as alignment } from "./rules/alignment/index.ts";
import { RULES as safety } from "./rules/safety/index.ts";
import { RULES as links } from "./rules/links/index.ts";
import { RULES as grounding } from "./rules/grounding/index.ts";
import { RULES as arc } from "./rules/arc/index.ts";
import { derive_alignment } from "./rules/alignment/derive.ts";

const kind_index = (kind: string): number =>
  (CHECK_KINDS as readonly string[]).indexOf(kind);

export function build_registry(
  groups: readonly (readonly CheckRule[])[],
): CheckRuleList {
  const seen = new Map<string, CheckRule>();
  for (const rule of groups.flat()) {
    if (kind_index(rule.kind) < 0) throw new Error(`unknown kind ${rule.kind}`);
    if (seen.has(rule.kind))
      throw new Error(`duplicate rule for kind ${rule.kind}`);
    seen.set(rule.kind, rule);
  }
  return CHECK_KINDS.map((kind) => {
    const rule = seen.get(kind);
    if (rule === undefined) throw new Error(`no rule for kind ${kind}`);
    return rule;
  });
}

export const RULE_GROUPS = {
  structural,
  alignment,
  safety,
  links,
  grounding,
  arc,
} as const;

export const CHECK_RULES: CheckRuleList = build_registry([
  structural,
  alignment,
  safety,
  links,
  grounding,
  arc,
]);

export function run_checks(
  ctx: CheckContext,
  rules: CheckRuleList,
  policy: CheckPolicy,
): CheckResult {
  // No try/catch: a failing rule must surface.
  const findings: CheckFinding[] = rules.flatMap((rule) =>
    rule.run(ctx, policy),
  );
  const keyed = findings.map((f, i) => ({ f, i }));
  keyed.sort((a, b) => {
    const k = kind_index(a.f.kind) - kind_index(b.f.kind);
    if (k !== 0) return k;
    const aa = a.f.address ?? "";
    const ba = b.f.address ?? "";
    if (aa < ba) return -1;
    if (aa > ba) return 1;
    return a.i - b.i;
  });
  const sorted = keyed.map((x) => x.f);
  const count = (level: CheckFinding["level"]): number =>
    sorted.filter((f) => f.level === level).length;
  return {
    content_hash: ctx.content_hash,
    findings: sorted,
    alignment: derive_alignment(ctx),
    blocking: count("blocking"),
    confirmation: count("confirmation"),
    advisory: count("advisory"),
    first_failing_kind:
      sorted.find((f) => f.level === "blocking")?.kind ?? null,
  };
}
