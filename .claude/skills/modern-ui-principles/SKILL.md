---
name: modern-ui-principles
description: Modern web-app UI principles (2025–2026) for any frontend Claude builds or refines — clarity over decoration, design tokens and owned shadcn-style components, a complete state set for every interactive element, WCAG 2.2 accessibility, performance-as-aesthetics, deliberate motion, and no "AI slop". Use whenever you build, restyle, refactor or review a web page, component, app screen, landing page, admin panel or standalone HTML file, or write a design.md / design brief. This skill is the index; the rules themselves live in the workspace-root `.claude/rules/ui-*.md` files.
type: capability
---

# Modern UI Principles for Web Apps

**What this does, concretely.** You load it before writing frontend code. The UI that comes out has a deliberate type and color system held in tokens. Every interactive element has its loading, empty, error, disabled and success states. It works by keyboard and at phone width, it feels fast, and it doesn't look like every other AI-generated page.

**How it's organized.** This file is the **index**. The principles are 16 rules with stable IDs (`UI-1`…`UI-16`), each with Do/Don't guidance. They live as separate rule files in `/Users/innocentnortey/Desktop/Nortorious-Technologies/.claude/rules/` and load automatically when you touch UI files (`.tsx/.jsx/.html/.css/.scss/.vue/.svelte/.astro`, Tailwind config, design docs). From a project launch where they didn't auto-load, read them by path. Cite IDs in reviews: *"Save button has no loading state — UI-11."*

## When to use

- Building or restyling a page, screen, component, form, table, modal, nav, or landing page
- Generating a standalone HTML file
- Starting a new frontend project, or writing its `design.md` / design brief
- Reviewing or polishing existing UI ("make this look better", "is this production-ready?")

**Not for:** backend work, CLI output, or dashboard content design. Client business dashboards follow `AI Consulting/.claude/rules/business-dashboards.md` for layout and color meaning.

## Core philosophy

1. **Clarity over decoration.** Clean layout, deliberate spacing, minimal cognitive load.
2. **Less is more.** Everything earns its place.
3. **Performance is aesthetics.** A slow interface looks worse than an imperfect one.
4. **Distinctive, not generic.** Never default to the AI-slop look.
5. **Design systems first.** Tokens > components > pages; own your components.
6. **Accessibility from day one.** WCAG 2.2 AA is the floor.

## Rule index

| Rule file (`.claude/rules/`) | Principles | Covers |
|---|---|---|
| `ui-precedence.md` | — | **Read first.** Who wins in a conflict: project design system > client dashboard rules > these rules. Also upstream codebases, the `frontend-design` companion, and evidence levels |
| `ui-process-and-design-doc.md` | UI-1 – UI-3 | Everything earns its place · design doc before code (with **design.md template**) · one screen and one dimension at a time, verified in a browser |
| `ui-layout-and-hierarchy.md` | UI-4 – UI-7 | Squint test · one primary action · spacing scale and exact alignment · mobile-first, container queries, parity |
| `ui-typography-and-color.md` | UI-8 – UI-9 | Distinctive type, scale, measure · committed palette in tokens, light and dark |
| `ui-tokens-and-components.md` | UI-10 | Tokens → primitives → patterns → pages · shadcn/Radix ownership · **stack preferences** |
| `ui-component-states.md` | UI-11 | The full state set: hover, focus, active, loading, empty, error, disabled, success |
| `ui-motion-and-performance.md` | UI-12 – UI-13 | Purposeful CSS-first motion, 150–300ms, reduced motion · INP/LCP/CLS, instant feedback |
| `ui-accessibility-and-semantics.md` | UI-14 – UI-15 | WCAG 2.2 AA contrast, keyboard, targets · semantic native-first HTML |
| `ui-anti-slop.md` | UI-16 | frontend_aesthetics anti-slop guidance · **anti-pattern index** mapping every anti-pattern to its rule |

Related, not part of this set: `html-files-not-artifacts.md` (HTML delivery), the `frontend-design` plugin skill (creative direction). Citations for every rule: `sources.md` in this folder.

## Workflow

1. **Precedence.** Check `ui-precedence.md`, then find the project's design system or brief.
2. **Design doc.** No design doc for a new product? Draft one from the template in `ui-process-and-design-doc.md`.
3. **Build one screen**, following the rules for layout, type and color, tokens, states, motion and accessibility.
4. **Render and verify** with Chrome DevTools MCP: desktop and ~400px screenshots, state screenshots, an accessibility audit.
5. **Run the checklist below.** Fix failures, citing UI-N.
6. **Capture** a new pattern or a rule that needed adapting in `learnings.md`.

## Implementation checklist — run before finalizing ANY UI

Answer from the **rendered** output, not from the code you meant to write.

- [ ] **Squint test passes:** purpose and primary action obvious when blurred (UI-4)
- [ ] **One clear primary action** per view; secondaries quieter (UI-5)
- [ ] **All states handled:** hover, focus-visible, active, loading, empty, error, disabled, success (UI-11)
- [ ] **Forms:** validate on blur then live, errors say what/why/fix, first error focused on submit, nothing cleared (UI-11)
- [ ] **Keyboard + screen reader:** full keyboard path, visible focus never hidden under sticky UI, labels, landmarks, native elements, no redundant ARIA (UI-14, UI-15)
- [ ] **Contrast verified with a tool:** text ≥ 4.5:1, UI ≥ 3:1, in every shipped theme; APCA second opinion on dark (UI-14)
- [ ] **Targets and drag:** 44×44 targets, every drag has a click/tap alternative (UI-14)
- [ ] **Consistent spacing & alignment:** every gap on the scale, edges aligned (UI-6)
- [ ] **Tokens only:** no hard-coded colors or magic numbers in components (UI-9, UI-10)
- [ ] **Distinctive, not generic,** *or* faithful to the project's design system (UI-16, precedence)
- [ ] **Fast:** instant feedback, no layout shift, skeletons not spinners (UI-13)
- [ ] **Motion purposeful** and `prefers-reduced-motion` respected (UI-12)
- [ ] **Mobile + desktop parity:** screenshots at ~400px and desktop; no horizontal page scroll (UI-7)

If you can't render it, say so. Don't tick boxes you didn't verify.

## Internal example prompt

> "I'm building **<screen>** for **<audience>** in **<project>**. First, check `ui-precedence.md` and the project's design system. If there is none, draft `design.md` with an intentional aesthetic direction, a distinctive type pairing, a dominant + accent palette in light and dark tokens, and a 4/8px spacing scale. Build only this one screen. Use owned token-based components, semantic native HTML, one primary action, and the full state set for every interactive element. Motion is 150–300ms and respects reduced motion. Then render it, take desktop and ~400px screenshots, run an accessibility audit, and go through the modern-ui-principles checklist, citing UI-N for anything I fix."

## Source

*Modern UI Principles for Web Apps (2025–2026)*, supplied by Innocent 2026-09-14. Verbatim copy: `source/2026-09-14-modern-ui-principles-original.md`. It cites @jasonlbeggs, @AdhamDannaway, @shadcn, the Claude Cookbook `frontend_aesthetics` guidance, community Claude Code skills, and Linear/Stripe/Vercel.

Additions not in the source: the precedence table, the INP/LCP/CLS numbers, the design.md template, the internal prompt, and a correction on touch targets (44×44 is WCAG AAA; AA is 24×24).

**Research pass, 2026-09-14.** The rules were checked against and extended with primary sources: WCAG 2.2's nine new criteria, NN/g (response-time limits, skeleton screens, empty states, form errors, the ten heuristics), Baymard (inline validation), web.dev (font loading, reduced motion), Material (dark theme, motion duration/easing), the W3C "Using ARIA" first rule, and Baseline status for modern CSS. Every citation is in `sources.md`, grouped by evidence level.
