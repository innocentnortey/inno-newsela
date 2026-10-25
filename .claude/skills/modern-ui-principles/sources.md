# modern-ui-principles — sources

What each rule leans on, so a future reader can check a claim rather than trust it. Grouped by evidence level. Checked 2026-09-14.

## Standards

- **WCAG 2.2** (W3C Recommendation, Oct 2023): https://www.w3.org/TR/WCAG22/ — contrast 1.4.3 / 1.4.11, focus 2.4.7 / 2.4.11 (Focus Not Obscured), 2.4.13 (Focus Appearance, AAA), dragging 2.5.7, target size 2.5.8 (AA, 24px) / 2.5.5 (AAA, 44px), consistent help 3.2.6, redundant entry 3.3.7, accessible authentication 3.3.8.
  - What's new in 2.2, plain-English: https://tetralogical.com/blog/2023/10/05/whats-new-wcag-2.2/ and https://dequeuniversity.com/resources/wcag-2.2/
  - Understanding Use of Color (1.4.1): https://www.w3.org/WAI/WCAG22/Understanding/use-of-color
- **Core Web Vitals thresholds** (good: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, measured at the 75th percentile of field data): https://web.dev/articles/vitals
- **Using ARIA / first rule of ARIA** (W3C): https://w3c.github.io/using-aria/ — MDN summary: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA — Deque's "no ARIA is better than bad ARIA" with the WebAIM Million figure: https://www.deque.com/blog/top-5-rules-of-aria/

## Research-backed guidance

- **NN/g — Response time limits (0.1s / 1s / 10s):** https://www.nngroup.com/articles/response-times-3-important-limits/ and https://www.nngroup.com/articles/powers-of-10-time-scales-in-ux/
- **NN/g — Skeleton screens (for waits under ~10s; progress bars beyond):** https://www.nngroup.com/articles/skeleton-screens/
- **NN/g — Empty states, three guidelines (status, learnability, direct path):** https://www.nngroup.com/articles/empty-state-interface-design/
- **NN/g — 10 usability heuristics:** https://www.nngroup.com/articles/ten-usability-heuristics/ — applied to complex apps: https://www.nngroup.com/articles/usability-heuristics-complex-applications/
- **NN/g — 10 guidelines for reporting errors in forms:** https://www.nngroup.com/articles/errors-forms-design-guidelines/
- **Baymard — Usability testing of inline form validation:** https://baymard.com/blog/inline-form-validation
- **web.dev — Best practices for fonts (`font-display`, preload, `size-adjust` and metric overrides):** https://web.dev/articles/font-best-practices and https://web.dev/articles/optimize-webfont-loading
- **web.dev — `prefers-reduced-motion` (what triggers vestibular symptoms):** https://web.dev/articles/prefers-reduced-motion — WebKit background: https://webkit.org/blog/7551/responsive-design-for-motion/
- **Material Design — dark theme (dark gray base, elevation as lightness, desaturated accents):** https://design.google/library/material-design-dark-theme and the codelab https://codelabs.developers.google.com/codelabs/design-material-darktheme
- **Material Design 3 — easing and duration tokens:** https://m3.material.io/styles/motion/easing-and-duration/tokens-specs — earlier duration/easing rationale: https://m1.material.io/motion/duration-easing.html
- **Touch targets, platform norms:** Apple HIG 44pt, Material 48dp, WCAG 24px. Comparison: https://tetralogical.com/blog/2022/12/20/foundations-target-size/
- **APCA status (candidate for WCAG 3, not adopted; WCAG 2 ratio weak on dark pairs):** https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html and https://github.com/Myndex/apca-introduction

## Platform support (Baseline)

- Container queries widely available (Aug 2025), `:has()` newly available (Dec 2023), same-document View Transitions Baseline after Firefox 144 (Oct 2025), `@starting-style` + `transition-behavior`, `text-wrap`. Summaries: https://www.buildmvpfast.com/blog/web-platform-baseline-2026-new-features-browser-support and https://cssawwwards.com/blog/complete-guide-modern-css-2026 — verify a specific feature at https://developer.mozilla.org/ (Baseline badge on each page).

## Practitioner consensus

- **Refactoring UI** (Wathan & Schoger): hierarchy through weight and color, de-emphasize rather than emphasize, labels as a last resort, subtle shadows. Summaries: https://github.com/erikuus/good-ui and https://medium.com/design-bootcamp/top-20-key-points-from-refactoring-ui-by-adam-wathan-steve-schoger-d81042ac9802
- **The original synthesis** this skill started from (`source/2026-09-14-modern-ui-principles-original.md`), citing @jasonlbeggs, @AdhamDannaway, @shadcn, the Claude Cookbook `frontend_aesthetics` guidance, and Linear/Stripe/Vercel.
- **`frontend-design` plugin skill** (Anthropic): the anti-slop and aesthetic-direction guidance, including the warning against converging on the same "distinctive" font across projects.
