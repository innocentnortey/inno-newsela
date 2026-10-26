import type { DraftRole } from "@ls/schema/lesson-draft";
import type { PMNode } from "@ls/schema/lesson";
import { SUPPORT_LABEL } from "./labels.ts";

/**
 * Which stored node proves that a draft role is present. One table for the compile tests and the structural checks;
 * oracle for the node names: docs/source/04-lesson-structure-analysis.md node table.
 */
export type RoleNode =
  | {
      readonly via: "node";
      readonly node: string;
      readonly attrs?: Readonly<Record<string, string>>;
      readonly attrs_not?: Readonly<Record<string, string>>;
      readonly attrs_prefix?: Readonly<Record<string, string>>;
    }
  | { readonly via: "mark"; readonly mark: "teacher_talk" | "sample_response" }
  | { readonly via: "text" }; // any non-empty text; the compiler keeps no node for this role

export const ROLE_NODE: Readonly<Record<DraftRole, RoleNode>> = {
  routine_heading: { via: "node", node: "routine_heading", attrs_not: { icon: "cfu" } },
  teacher_talk: { via: "mark", mark: "teacher_talk" },
  sample_response: { via: "mark", mark: "sample_response" },
  callout_purpose: { via: "node", node: "callout", attrs: { variant: "purpose" } },
  callout_say: { via: "node", node: "callout", attrs: { variant: "say" } },
  callout_watch: { via: "node", node: "callout", attrs: { variant: "watch" } },
  // prefix: docs/source/04 line 62 lets the label carry a suffix such as "Additional Student Support: Finding Evidence"
  support_table: { via: "node", node: "collapsible", attrs_prefix: { label: SUPPORT_LABEL } },
  cfu_item: { via: "node", node: "routine_heading", attrs: { icon: "cfu" } },
  quick_write: { via: "node", node: "routine_heading", attrs: { icon: "writing" } },
  text_evidence_needed: { via: "node", node: "quote_placeholder" },
  excerpt_slot: { via: "node", node: "excerpt_slot" },
  teacher_tip: { via: "node", node: "teacher_tip" },
  homework: { via: "text" },
  paragraph: { via: "node", node: "paragraph" },
  list: { via: "node", node: "bullet_list" },
};

function flatten(nodes: readonly PMNode[], out: PMNode[] = []): PMNode[] {
  for (const n of nodes) {
    out.push(n);
    if (n.content !== undefined) flatten(n.content, out);
  }
  return out;
}

export function role_present(nodes: readonly PMNode[], role: DraftRole): boolean {
  const rule = ROLE_NODE[role];
  const all = flatten(nodes);
  switch (rule.via) {
    case "mark":
      return all.some((n) => n.type === "text" && (n.marks ?? []).some((m) => m.type === rule.mark));
    case "text":
      return all.some((n) => n.type === "text" && (n.text ?? "").trim() !== "");
    case "node":
      return all.some((n) => {
        if (n.type !== rule.node) return false;
        const a = n.attrs ?? {};
        if (Object.entries(rule.attrs ?? {}).some(([k, v]) => String(a[k]) !== v)) return false;
        if (Object.entries(rule.attrs_not ?? {}).some(([k, v]) => String(a[k]) === v)) return false;
        return Object.entries(rule.attrs_prefix ?? {}).every(([k, v]) => String(a[k] ?? "").startsWith(v));
      });
  }
}

/** Trimmed text of every top-level level-2 heading. */
export function parts_present(nodes: readonly PMNode[]): string[] {
  return nodes
    .filter((n) => n.type === "heading" && n.attrs?.level === 2)
    .map((n) =>
      flatten([n])
        .map((x) => x.text ?? "")
        .join("")
        .trim(),
    );
}
