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
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="checklist-h" className="text-ink text-sm font-semibold">
          {COPY.checklistHeading}
        </h2>
        <p className="text-label text-ink3">{COPY.checklistSub}</p>
      </div>
      <ul className="mt-1 flex flex-col">
        {rows.map((r, i) => (
          <li key={`${r.key}-${i}`} data-state={r.state} className="border-hair flex items-start gap-3 border-t py-3 first:border-t-0">
            <Glyph shape={r.state === "ok" ? "circle-check" : "octagon-bar"} className={`mt-1 size-4 shrink-0 ${r.state === "ok" ? "text-success" : "text-danger"}`} />
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
