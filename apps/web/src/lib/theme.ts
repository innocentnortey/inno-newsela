// design.md "Design tokens": light is the default theme; DQ-4 adds dark and "match system" from the account menu.
// The choice is a per-viewer convenience kept in localStorage; every access is guarded (private windows, blocked storage).

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "ls-theme";
export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "dark", "system"];
export const THEME_LABEL: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "Match system" };

function isChoice(v: unknown): v is ThemeChoice {
  return v === "light" || v === "dark" || v === "system";
}

export function readTheme(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isChoice(v) ? v : "light";
  } catch {
    return "light";
  }
}

/** `system` removes the attribute so the `prefers-color-scheme` block in tokens.css decides. */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function saveTheme(choice: ThemeChoice): void {
  applyTheme(choice);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage unavailable: the choice holds for this page only.
  }
}

/** Runs before first paint (app/layout.tsx) so a stored dark choice never flashes light, and vice versa. */
export const THEME_BOOTSTRAP = `(function(){try{var v=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var r=document.documentElement;if(v==="system")r.removeAttribute("data-theme");else if(v==="dark")r.setAttribute("data-theme","dark");}catch(e){}})();`;
