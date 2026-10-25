import { Link } from "@/components/ui/link";
import { FIRED_CUTS } from "@/features/frame/nav";

export function LinksRow({ unitKey, runId }: { unitKey: string; runId: string | null }) {
  const links: { label: string; href: string; cut?: number }[] = [];
  if (runId) {
    links.push({ label: "Run summary", href: `/units/${unitKey}/runs/${runId}/summary` });
    links.push({ label: "Unit plan", href: `/units/${unitKey}/runs/${runId}/plan` });
  }
  links.push({ label: "Coverage", href: `/units/${unitKey}/coverage`, cut: 4 });
  links.push({ label: "Unit quality", href: `/units/${unitKey}/quality`, cut: 6 });
  links.push({ label: "Export", href: `/units/${unitKey}/export`, cut: 5 });
  return (
    <nav aria-label="Related pages" className="flex flex-wrap gap-4">
      {links
        .filter((l) => l.cut === undefined || !FIRED_CUTS.includes(l.cut))
        .map((l) => (
          <Link key={l.label} href={l.href}>
            {l.label}
          </Link>
        ))}
    </nav>
  );
}
