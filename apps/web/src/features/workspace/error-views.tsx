import { Link } from "@/components/ui/link";

export function SchemaUnknownView({ lessonLabel, schemaVersion, boardHref }: { lessonLabel: string; schemaVersion: number | null; boardHref: string }) {
  return (
    <div role="alert" className="text-body text-ink flex flex-col items-start gap-3">
      <p>{`${lessonLabel} won't open. It uses schema version ${schemaVersion ?? "unknown"}, which this app doesn't know yet. Nothing has been dropped.`}</p>
      <Link href={boardHref}>Back to the board</Link>
    </div>
  );
}
