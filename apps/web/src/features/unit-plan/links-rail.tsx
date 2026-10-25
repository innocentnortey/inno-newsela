import { SideRail } from "@/components/layout/two-pane";
import { Link } from "@/components/ui/link";
import type { components } from "@/lib/api-types";
import {
  lessonHref,
  lessonTitle,
  NO_LINKS_TEXT,
  splitLinkLabel,
} from "./plan-copy";

type LessonLink = components["schemas"]["LessonLink"];

function Part({ href, text }: { href: string | null; text: string }) {
  return href ? <Link href={href}>{text}</Link> : <>{text}</>;
}

export function LinksRail({
  links,
  unitKey,
}: {
  links: LessonLink[];
  unitKey: string;
}) {
  return (
    <SideRail title="Links between lessons" narrow>
      {links.length === 0 ? (
        <p className="text-small text-ink2">{NO_LINKS_TEXT}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {links.map((l) => {
            const parts = splitLinkLabel(l.label) ?? {
              from: lessonTitle(l.from_lesson_id),
              to: lessonTitle(l.to_lesson_id),
            };
            return (
              <li key={l.link_id} className="text-small text-ink">
                <Part
                  href={lessonHref(unitKey, l.from_lesson_id)}
                  text={parts.from}
                />
                {" → "}
                <Part
                  href={lessonHref(unitKey, l.to_lesson_id)}
                  text={parts.to}
                />
              </li>
            );
          })}
        </ul>
      )}
    </SideRail>
  );
}
