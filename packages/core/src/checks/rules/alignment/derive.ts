import type { AlignmentLinkRow, CheckContext } from "../../types.ts";
import { cfu_tags, covered, focus_codes, recorded, teaching_parts } from "./standards-view.ts";

export function derive_alignment(ctx: CheckContext): AlignmentLinkRow[] {
  const rec = recorded(ctx);
  const rec_codes = new Set(rec.map((s) => s.code));
  const codes = [
    ...new Set([...focus_codes(ctx), ...rec.filter((s) => s.role === "supporting").map((s) => s.code)]),
  ];
  const parts = teaching_parts(ctx.lesson);
  const tags = cfu_tags(ctx);
  const rows: AlignmentLinkRow[] = [];
  const seen = new Set<string>();
  const push = (row: AlignmentLinkRow): void => {
    const key = `${row.code}|${row.address}|${row.role}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };
  for (const code of codes) {
    const s = rec.find((x) => x.code === code);
    const origin: AlignmentLinkRow["origin"] =
      s === undefined || s.origin === "outline-fixed" ? "outline" : s.origin;
    const asserted_by: AlignmentLinkRow["asserted_by"] = s?.asserted_by ?? "outline";
    const confirmed_by =
      ctx.confirmations.find((c) => c.code === code && c.confirmed_by !== null)?.confirmed_by ?? null;
    const base = { lesson_id: ctx.lesson_id, content_hash: ctx.content_hash, code, origin, asserted_by, confirmed_by };
    parts.forEach((address, i) => push({ ...base, address, role: i === 0 ? "I" : "P" }));
    for (const t of tags) {
      if (covered(code, [t], rec_codes)) push({ ...base, address: t.address, role: "A" });
    }
  }
  return rows;
}
