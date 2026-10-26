export type PartRemap = { section: string; from: string; to: string };
export type PartPlan = { label_of(raw: string): string; title_of(label: string): string | null; remaps: PartRemap[] };

const LETTERED = /^(?:part\s+)?([A-Za-z])(?:\s*[:.\-–—]\s*(.+))?$/i;

/** Maps the raw part labels of one section to canonical "Part A", "Part B". Deterministic: same raw, same label. */
export function plan_parts(section: string, parts: readonly (string | null)[]): PartPlan {
  const raws: string[] = [];
  for (const p of parts) {
    if (p === null) continue;
    const t = p.trim();
    if (!raws.includes(t)) raws.push(t);
  }
  const map = new Map<string, string>();
  const titles = new Map<string, string>();
  const taken = new Set<string>();
  for (const raw of raws) {
    const m = LETTERED.exec(raw);
    if (m === null) continue;
    const label = `Part ${(m[1] ?? "").toUpperCase()}`;
    map.set(raw, label);
    taken.add(label);
    const title = m[2]?.trim();
    if (title && !titles.has(label)) titles.set(label, title);
  }
  let next = 0;
  for (const raw of raws) {
    if (map.has(raw)) continue;
    let label = "";
    while (next < 26) {
      const cand = `Part ${String.fromCharCode(65 + next)}`;
      next += 1;
      if (!taken.has(cand)) { label = cand; break; }
    }
    if (label === "") throw new RangeError("too many parts");
    taken.add(label);
    map.set(raw, label);
    if (!titles.has(label)) titles.set(label, raw);
  }
  const remaps: PartRemap[] = [];
  for (const raw of raws) {
    const to = map.get(raw)!;
    if (raw !== to) remaps.push({ section, from: raw, to });
  }
  return {
    label_of: (raw) => map.get(raw.trim()) ?? raw.trim(),
    title_of: (label) => titles.get(label) ?? null,
    remaps,
  };
}
