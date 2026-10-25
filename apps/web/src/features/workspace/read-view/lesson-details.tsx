import type { components } from "@/lib/api-types";

type Lesson = components["schemas"]["Lesson"];

function show(v: unknown): string | null {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v.join(", ");
  return null;
}

export function LessonDetails({ lesson }: { lesson: Lesson }) {
  const entries = Object.entries(lesson.front_matter)
    .filter(([k]) => k !== "standards")
    .map(([k, v]) => [k, show(v)] as const)
    .filter((e): e is readonly [string, string] => e[1] !== null);
  return (
    <details data-testid="lesson-details" className="text-small">
      <summary className="text-ink2 cursor-pointer font-semibold">Lesson details</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {lesson.sections.map((s) => (
          <li key={s.address}>{`${s.name}: ${s.minutes} min`}</li>
        ))}
        {entries.map(([k, v]) => (
          <li key={k}>{`${k.replaceAll("_", " ")}: ${v}`}</li>
        ))}
      </ul>
    </details>
  );
}
