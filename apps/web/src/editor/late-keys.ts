/**
 * Keys typed after the editor turned read-only (S-125-3, option A).
 * The browser drops them silently; this captures printable ones so the "Removed text" notice can show them.
 * Nothing is sent to the server and nothing enters a Y.Doc. Never calls preventDefault.
 */
export const ENGAGED_MS = 1500; // a flip counts only if a printable key went into the editor this recently
export const LATE_KEY_IDLE_MS = 1000; // capture ends after this gap between captured keys

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
}

/** The character a key press types, or null (Enter, Backspace, arrows, shortcuts, IME composition). */
export function printable_key(e: KeyLike): string | null {
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || e.isComposing)
    return null;
  return e.key;
}

export interface LateKeyCaptureOptions {
  root: HTMLElement;
  doc: Document;
  is_editable: () => boolean;
  on_text: (s: string) => void;
  now?: () => number;
}
export interface LateKeyCapture {
  arm(): void;
  disarm(): void;
  dispose(): void;
}

export function create_late_key_capture(
  o: LateKeyCaptureOptions,
): LateKeyCapture {
  const now = o.now ?? Date.now;
  let last_at = -Infinity;
  let armed = false;
  const on_keydown = (e: KeyboardEvent): void => {
    const ch = printable_key(e);
    if (ch === null) return;
    const t = e.target as Node | null;
    const inside = !!t && o.root.contains(t);
    const bare = t === o.doc.body || t === o.doc.documentElement;
    if (!inside && !bare) return;
    const n = now();
    if (armed) {
      if (o.is_editable() || n - last_at > LATE_KEY_IDLE_MS) armed = false;
      else {
        last_at = n;
        o.on_text(ch);
        return;
      }
    }
    if (inside && o.is_editable()) last_at = n;
  };
  o.doc.addEventListener("keydown", on_keydown, true);
  return {
    arm() {
      armed = now() - last_at <= ENGAGED_MS;
    },
    disarm() {
      armed = false;
    },
    dispose() {
      o.doc.removeEventListener("keydown", on_keydown, true);
    },
  };
}
