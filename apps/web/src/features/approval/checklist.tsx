import { Glyph } from "@/components/ui/glyph";
import { Link } from "@/components/ui/link";
import { COPY } from "./copy";
import type { Row } from "./derive";

function focusSection(href: string) {
  document.getElementById(href.slice(1))?.focus();
}

export function Checklist({ rows }: { rows: Row[] }) {
  return (
    <section aria-labelledby="checklist-h">
      <h2 id="checklist-h" className="text-ink text-sm font-semibold">
        {COPY.checklistHeading}
      </h2>
      <p className="text-small text-ink2 mb-2">{COPY.checklistSub}</p>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={`${r.key}-${i}`} data-state={r.state} className="bg-panel border-hair flex items-start gap-3 rounded-lg border px-3 py-2">
            <Glyph shape={r.state === "ok" ? "circle-check" : "octagon-bar"} className={`mt-1 shrink-0 ${r.state === "ok" ? "text-success" : "text-danger"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-body text-ink">
                <span className={`text-label mr-2 ${r.state === "ok" ? "text-success" : "text-danger"}`}>{r.stateWord}</span>
                <span className="font-semibold">{r.title}</span>
              </p>
              <p className="text-small text-ink2">{r.evidence}</p>
              <p className="text-small flex flex-wrap gap-3">
                {r.jump ? (
                  <Link href={r.jump.href} onClick={() => setTimeout(() => focusSection(r.jump!.href), 0)}>
                    {r.jump.label}
                  </Link>
                ) : null}
                {r.link ? <Link href={r.link.href}>{r.link.label}</Link> : null}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
