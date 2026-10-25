import type { PresenceEntry } from "@/editor/presence";
import { presence_sentence } from "@/editor/presence";

export function PresenceSentence({ entries }: { entries: PresenceEntry[] }) {
  const text = presence_sentence(entries);
  if (text === "") return null;
  return (
    <p data-testid="presence-sentence" className="text-small text-ink2">
      {text}
    </p>
  );
}

export function PresenceInitials({ entries, address }: { entries: PresenceEntry[]; address: string }) {
  const here = entries.filter((e) => e.section_address === address);
  if (here.length === 0) return null;
  return (
    <span className="inline-flex gap-1">
      {here.map((e) => (
        <span key={e.client_id} data-slot="initials" data-presence-slot={e.slot} aria-label={`${e.name} is here`} className="text-caps">
          {e.initials}
        </span>
      ))}
    </span>
  );
}
