import type { components } from "@/lib/api-types";

type Issue = components["schemas"]["Issue"];

const FLAG_IN_MESSAGE = /Safety note (\S+) is open/;

/**
 * The server flag id for a safety_flag_open issue. Issue carries no flag id (seam S-30), so it is read from the
 * finding's message. No match returns null: the caller hides the button rather than send a wrong id.
 */
export function flagIdFor(issue: Pick<Issue, "kind" | "message">): string | null {
  if (issue.kind !== "safety_flag_open") return null;
  return FLAG_IN_MESSAGE.exec(issue.message)?.[1] ?? null;
}
