import type { EditorClientState } from "@/editor/client-state";

const FMT = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

export function format_saved_time(iso: string): string {
  return FMT.format(new Date(iso));
}

export function save_state_text(state: EditorClientState, stored_at: string | null, connecting_ms: number): string {
  switch (state) {
    case "connecting":
      return connecting_ms >= 1000 ? "Connecting to the editor…" : "";
    case "synced":
      return "Connected";
    case "saving":
      return "Saving…";
    case "stored":
      return stored_at ? `Saved · ${format_saved_time(stored_at)}` : "Saved";
    case "DISCONNECTED":
      return "Not saved";
    case "read_only":
      return "Read-only";
  }
}
