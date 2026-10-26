"use client";
import type { RefObject } from "react";
import { Glyph } from "@/components/ui/glyph";
import type { components } from "@/lib/api-types";
import { jumpToAddress } from "./jump";
import { groupSections, totalMinutes } from "./state-model";

type Section = components["schemas"]["Section"];
type Issue = components["schemas"]["Issue"];

export function OutlineColumn({ sections, issues, textRootRef }: { sections: Section[]; issues: Issue[]; textRootRef: RefObject<HTMLElement | null> }) {
  const blocking = issues.filter((i) => i.level === "blocking" && !i.resolution && i.address);
  return (
    <nav aria-label="Lesson sections" className="flex flex-col gap-2.5 pt-1">
      <p className="text-label text-ink3 font-semibold">{`Sections · ${totalMinutes(sections)} min`}</p>
      <ul className="flex flex-col gap-0.5">
        {groupSections(sections).map((g) => {
          const flagged = blocking.some((i) => g.parts.some((p) => i.address === p.address || (i.address ?? "").startsWith(p.address + ".")));
          return (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => textRootRef.current && jumpToAddress(textRootRef.current, g.parts[0]?.address ?? g.key, null)}
                className="text-small text-ink2 hover:bg-panel hover:text-ink flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 pl-2.5 text-left whitespace-nowrap hover:shadow-[inset_0_0_0_1px_var(--color-hair)]"
              >
                <span className="flex-1">{g.name}</span>
                {g.minutes > 0 ? <span className="text-label text-ink3 tabular-nums">{g.minutes}</span> : null}
                {flagged ? (
                  <>
                    <Glyph shape="octagon-bar" className="text-danger" />
                    <span className="sr-only">Blocking issue</span>
                  </>
                ) : null}
              </button>
              {g.parts.length > 1 ? (
                <ul className="flex flex-col gap-0.5 pl-3">
                  {g.parts.map((p) => (
                    <li key={p.address}>
                      <button
                        type="button"
                        onClick={() => textRootRef.current && jumpToAddress(textRootRef.current, p.address, null)}
                        className="text-small text-ink2 hover:bg-panel hover:text-ink flex w-full gap-1.5 rounded-md py-1.5 pr-2 pl-2.5 text-left hover:shadow-[inset_0_0_0_1px_var(--color-hair)]"
                      >
                        <span className="flex-1">{p.name.match(/Part [A-Z]$/)?.[0] ?? p.name}</span>
                        <span className="text-label text-ink3 tabular-nums">{p.minutes}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
