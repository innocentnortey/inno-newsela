import type { AlignmentLinkRow, CheckContext } from "../../types.ts";
import { doc_tags, focus_obligations, recorded, tag_covers, teaching_addresses } from "./standards-view.ts";

/** Links come only from tags on headings. They are the generator's or outline's claim; none is confirmed here. */
export function derive_alignment(ctx: CheckContext): AlignmentLinkRow[] {
  const rec = recorded(ctx);
  const codes = [
    ...new Set([...focus_obligations(ctx).map((o) => o.code), ...rec.filter((s) => s.role === "supporting").map((s) => s.code)]),
  ];
  const tags = doc_tags(ctx.lesson);
  const where = teaching_addresses(ctx.lesson);
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
    let first = true;
    for (const t of tags) {
      if (t.code !== code || t.kind !== "teach" || !where.has(t.address)) continue;
      const key = `${code}|${t.address}`;
      if (seen.has(`${key}|I`) || seen.has(`${key}|P`)) continue;
      push({ ...base, address: t.address, role: first ? "I" : "P" });
      first = false;
    }
    for (const t of tags) {
      if (t.code === code && t.kind === "assess" && tag_covers(ctx, t)) {
        push({ ...base, address: t.address, role: "A" });
      }
    }
  }
  return rows;
}
