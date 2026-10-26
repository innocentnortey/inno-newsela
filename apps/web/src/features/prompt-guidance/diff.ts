export interface DiffLine {
  kind: "add" | "remove" | "same";
  text: string;
}

/** One entry per line. A leading "+" or "-" is the marker; the text keeps the marker's following space stripped. */
export function parseDiff(diff: string): DiffLine[] {
  if (diff === "") return [];
  return diff.split("\n").map((raw) => {
    const kind = raw.startsWith("+")
      ? "add"
      : raw.startsWith("-")
        ? "remove"
        : "same";
    const text = kind === "same" ? raw : raw.slice(1).replace(/^ /, "");
    return { kind, text };
  });
}

/** The editor's starting text: the added and unmarked lines of the latest version's diff (plan section 6, item 1). */
export function latestText(
  versions: readonly { number: number; diff: string }[],
): string {
  if (versions.length === 0) return "";
  const latest = versions.reduce((a, b) => (b.number > a.number ? b : a));
  return parseDiff(latest.diff)
    .filter((l) => l.kind !== "remove")
    .map((l) => l.text)
    .join("\n");
}
