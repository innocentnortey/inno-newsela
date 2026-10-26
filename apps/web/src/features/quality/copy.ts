import { unitIdFromKey } from "@/lib/keys";

// Presentation labels only. Nothing in this folder computes, rounds, converts or ranks a number.

export const COPY = {
  eyebrow: "Unit",
  title: "Unit quality",
  loading: "Loading unit quality",
  cantLoadThing: "unit quality",
  empty: "No approved lessons yet",
  contextLabel: "Reviewer time context",
  ratingsCaption: "Draft-quality ratings",
  seededCaption: "Seeded-error report",
  usable: "Usable as drafted",
  usableWithEdits: "Usable with edits",
  rewritten: "Rewritten",
  planted: "Planted",
  caught: "Caught",
} as const;

export const GROUPS = [
  { prefix: "V", heading: "Draft quality (V)" },
  { prefix: "O", heading: "Operations and cost (O)" },
  { prefix: "H", heading: "Health (H)" },
] as const;
export const OTHER_GROUP = "Other";

/** Unit column of docs/design/metrics-registry.md, wording only. CON-10 tiles carry no unit field. */
export const TILE_UNITS: Record<string, string> = {
  "V-1": "%",
  "V-2": "%",
  "V-3": "%",
  "V-4": "(0–1)",
  "V-5": "%",
  "V-6": "%",
  "O-1": "USD per lesson",
  "O-2": "lessons per hour",
  "O-3": "days",
  "O-4": "%",
  "H-1": "%",
  "H-2": "minutes",
  "H-3": "% of cap",
  "H-4": "seconds",
  "H-5": "ms",
  "H-6": "seconds",
};

export function unitLabel(unitKey: string): string {
  const id = unitIdFromKey(unitKey);
  const m = id && /^G(\d+)\.U(\d+)$/.exec(id);
  return m ? `Grade ${m[1]} · Unit ${m[2]}` : unitKey;
}
