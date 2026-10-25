import type { StatusKey } from "@/components/ui/status";
import type { components } from "@/lib/api-types";

type Issue = components["schemas"]["Issue"];
type Section = components["schemas"]["Section"];

export function kindLabel(kind: string): string {
  return kind.replaceAll("_", " ");
}

export function kindSentence(kind: string): string {
  const s = kindLabel(kind);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const STANDARDS_KINDS: readonly string[] = [
  "standard_confirmation",
  "standard_add_suggestion",
  "standard_not_taught",
  "standard_not_checked",
  "code_not_allowed",
  "eld_label_mismatch",
];

export function tabForKind(kind: string): "issues" | "standards" {
  return STANDARDS_KINDS.includes(kind) ? "standards" : "issues";
}

export function issueStatusKey(issue: Issue): StatusKey {
  if (issue.resolution) return "issue.resolved";
  if (issue.level === "blocking") return "issue.blocking";
  if (issue.level === "confirmation") return "issue.confirmation";
  return "issue.advisory";
}

export function addressLabel(address: string, sections: Section[]): string {
  const exact = sections.find((s) => s.address === address);
  if (exact) return exact.name;
  const prefixed = sections
    .filter((s) => address.startsWith(s.address + "."))
    .sort((a, b) => b.address.length - a.address.length)[0];
  return prefixed ? prefixed.name : (address.split(".").pop() ?? address);
}
