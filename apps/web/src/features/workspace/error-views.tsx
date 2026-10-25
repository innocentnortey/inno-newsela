import { Link } from "@/components/ui/link";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";

export function SchemaUnknownView({
  lessonLabel,
  schemaVersion,
  unknownNodes = [],
  boardHref,
}: {
  lessonLabel: string;
  schemaVersion: number | null;
  unknownNodes?: string[];
  boardHref: string;
}) {
  // A version this app knows but a node it does not: say so, instead of blaming the version.
  const nodeCase = schemaVersion === SCHEMA_VERSION && unknownNodes.length > 0;
  const reason = nodeCase
    ? `It has content this app doesn't know how to show (${unknownNodes.join(", ")}).`
    : `It uses schema version ${schemaVersion ?? "unknown"}, which this app doesn't know yet.`;
  return (
    <div role="alert" className="text-body text-ink flex flex-col items-start gap-3">
      <p>{`${lessonLabel} won't open. ${reason} Nothing has been dropped.`}</p>
      <Link href={boardHref}>Back to the board</Link>
    </div>
  );
}
