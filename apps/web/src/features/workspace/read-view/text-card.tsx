import { CodeChip } from "@/components/ui/badge";
import type { components } from "@/lib/api-types";

type TextCard = components["schemas"]["TextCard"];

export function TextCardView({ card }: { card: TextCard }) {
  const edition = card.edition_or_isbn;
  const parts = [
    card.title,
    card.author,
    edition ? `${/^\d{10}(\d{3})?$/.test(edition) ? "ISBN" : "Edition"} ${edition}` : null,
    card.chapter ? `Chapter ${card.chapter}` : null,
    card.pages ? `pp. ${card.pages}` : null,
  ].filter(Boolean);
  return (
    <div data-testid="text-card" className="bg-well flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-small">
      <span>{parts.join(" · ")}</span>
      <CodeChip>{card.kind}</CodeChip>
      {card.rights_status ? <span className="text-ink2">{`Rights: ${card.rights_status}`}</span> : null}
    </div>
  );
}
