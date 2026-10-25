export function parseUnitTitle(
  title: string | undefined,
  unitKey: string,
): { grade: string | null; unit: string; novel: string | null } {
  if (title) {
    const parts = title.split(" · ");
    const grade = parts.find((p) => /^Grade \d+$/.test(p)) ?? null;
    const unit = parts.find((p) => /^Unit \d+$/.test(p));
    if (unit) {
      const rest = parts.filter((p) => p !== grade && p !== unit);
      return { grade, unit, novel: rest.length > 0 ? rest.join(" · ") : null };
    }
  }
  const m = /^g(\d+)-u(\d+)$/.exec(unitKey);
  if (m) return { grade: `Grade ${m[1]}`, unit: `Unit ${m[2]}`, novel: null };
  return { grade: null, unit: unitKey, novel: null };
}
