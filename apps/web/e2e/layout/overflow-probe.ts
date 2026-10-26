import type { Page } from "@playwright/test";

export interface OverflowReport {
  overflow: number;
  widest: { tag: string; slot: string | null; cls: string; right: number }[];
}

/** After navigation: how far the page scrolls sideways and which elements stick out past the viewport (top 5). */
export function overflowProbe(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const out = [...document.querySelectorAll("body *")]
      .map((el) => ({ el, right: Math.round(el.getBoundingClientRect().right) }))
      .filter((x) => x.right > vw)
      // In-flow content inside an overflow-x:auto/hidden ancestor is clipped there and cannot widen the page.
      // An absolutely positioned element is clipped only if a positioned ancestor sits inside that scroller.
      .filter(({ el }) => {
        const abs = getComputedStyle(el).position === "absolute";
        let positioned = false;
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (cs.overflowX !== "visible") return abs && !positioned;
          if (cs.position !== "static") positioned = true;
        }
        return true;
      })
      .sort((a, b) => b.right - a.right)
      .slice(0, 5)
      .map(({ el, right }) => ({
        tag: el.tagName.toLowerCase(),
        slot: el.getAttribute("data-slot") ?? el.getAttribute("data-testid"),
        cls: String(el.getAttribute("class") ?? "").slice(0, 120),
        right,
      }));
    return { overflow: document.documentElement.scrollWidth - vw, widest: out };
  });
}
