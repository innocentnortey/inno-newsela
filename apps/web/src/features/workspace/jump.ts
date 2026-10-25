function escapeAttr(address: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(address) : address.replace(/["\\]/g, "\\$&");
}

export function sectionElement(root: ParentNode, address: string): HTMLElement | null {
  const a = escapeAttr(address);
  return (
    root.querySelector<HTMLElement>(`[data-address="${a}"]`) ?? root.querySelector<HTMLElement>(`[data-address^="${a}."]`)
  );
}

export function jumpToAddress(root: ParentNode, address: string | null, preferNode: "slot" | null): boolean {
  if (!address) return false;
  const section = sectionElement(root, address);
  if (!section) return false;
  const target =
    (preferNode === "slot"
      ? section.querySelector<HTMLElement>('[data-node="quote_placeholder"],[data-node="excerpt_slot"]')
      : null) ??
    section.querySelector<HTMLElement>("[data-text-region]") ??
    section;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.scrollIntoView?.({ block: "center" });
  target.focus({ preventScroll: true });
  return true;
}

const SLOT_KINDS = ["quote_placeholder_open", "excerpt_slot_open", "cross_lesson_link", "rights_to_clear"];

export function preferNodeFor(kind: string): "slot" | null {
  return SLOT_KINDS.includes(kind) ? "slot" : null;
}
