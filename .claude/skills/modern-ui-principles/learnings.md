# modern-ui-principles — learnings

Append-only. Newest last. Never edit a prior entry; add a corrective follow-up.

## 2026-09-14 — skill created

Built from Innocent's *Modern UI Principles for Web Apps (2025–2026)* (`source/`). It's the general `UI-N` set; business dashboards have their own `BD-N` set in `AI Consulting/.claude/skills/business-dashboard-design/`.

- **The source's absolutes collide with live projects.** "Avoid Arial/system defaults" and "dark-mode first" contradict the Command Center's own `design-system.md` (Helvetica Neue body, no dark mode, flat gold). "Bento grids for SaaS dashboards" and "dominant color + accent" contradict the BD set's neutral, attention-first dashboards. Resolved with a precedence table: project design system > BD skill (for client dashboards) > this skill. Inter appeared only in client artifacts and one Selph visualization, so no live product is flagged by UI-8.
- **Corrected a source error:** 44×44px touch targets are WCAG AAA (2.5.5) / Apple HIG, not the 2.2 baseline; AA is 24×24 (2.5.8). 44 is kept as the house target.
- **Overlap with the `frontend-design` plugin skill.** The plugin already carries the frontend_aesthetics anti-slop guidance. It also warns against converging on the same "distinctive" font (e.g. Space Grotesk), which the source lists as a good pick. Both are reflected in UI-8/UI-16. The plugin drives creative direction; this skill is the engineering discipline around it.
- **Root skills don't appear in project launches** (observed from a `Gauntlet AI/` launch). The root rule `.claude/rules/modern-ui-principles.md` points to this file by absolute path so it's reachable anyway.
- Not yet exercised on a real build.

## 2026-09-14 — restructured: skill is the index, rules hold the principles

Innocent wanted the skill to be a general description that points to rules in the root `.claude/rules/` folder, not one monolithic SKILL.md. The principles were split into nine `ui-*.md` rule files (precedence, process + design doc, layout, typography + color, tokens + components + stack, component states, motion + performance, accessibility + semantics, anti-slop + anti-pattern index). All share the same UI-file `paths:`. SKILL.md keeps the description, the rule index, the workflow, the pre-ship checklist and the internal prompt. The single `modern-ui-principles.md` rule was deleted. IDs UI-1…UI-16 are unchanged.

## 2026-09-14 — research pass against primary sources

Innocent asked for improvements from my own judgment plus web research. What changed and why:

- **WCAG 2.2's nine new criteria were missing.** Added Focus Not Obscured (sticky headers can't hide focus), Dragging Movements (every drag needs a click alternative), Target Size AA 24px with the 44px house standard (Apple 44pt / Material 48dp), Consistent Help, Redundant Entry, Accessible Authentication. These are standards, not taste.
- **Loading indicators now follow NN/g's 0.1s / 1s / 10s limits**, with a ~200–300ms delay before showing any indicator so fast responses don't flicker, skeletons for regions under ~10s, and progress bars beyond.
- **Form validation timing settled by research:** validate on blur, re-validate live once errored, keep data on submit failure, focus the first error, errors say what/why/fix (NN/g; Baymard's ~2% figure).
- **Empty states split into four kinds** (first use, cleared, no results, error) per NN/g's three guidelines.
- **Dark theme rules from Material:** dark gray base not pure black, elevation as lightness, desaturated accents. **APCA** noted as a second opinion for dark palettes only; WCAG 2 ratio stays the floor since WCAG 3 isn't adopted.
- **Motion durations now scale with size/distance** (Material), with reduced-motion written as opt-in and a concrete list of what triggers vestibular symptoms (web.dev).
- **Fonts:** `size-adjust` and metric overrides for the fallback, preload only above-the-fold faces (web.dev).
- **Baseline table added** so container queries, `:has()`, `oklch`, `@starting-style`, same-document View Transitions are asserted usable rather than "check support". Cross-document view transitions and scroll-driven animations still flagged.
- **Refactoring UI habits** folded into hierarchy/typography: de-emphasize before emphasizing, labels last, subtle shadows.
- **NN/g's ten heuristics** added as the review lens under UI-3, and "undo over confirm" under UI-5.
- **`sources.md`** created with every citation grouped by evidence level; `ui-precedence.md` now names "research-backed guidance" as a tier between standards and practitioner consensus.
- Not changed: the 16 IDs, the paths, the precedence order.

## 2026-09-14 — first real build: AgentForge PRD HTML (`Gauntlet AI/artifacts/2026-09-14-agentforge-prd.html`)

- **Visual check of a local HTML file: what worked.**
  - **The standalone `chrome-devtools` MCP** was blocked ("browser is already running for …/chrome-devtools-mcp/jobsearch"), because another session's profile held the lock. Don't kill it.
  - **Headless Chrome `--headless=new --screenshot=… --window-size=…`** wrote the PNG but **the process never exited**. Only that first screenshot came out before the job hung; it also rendered the dark theme with no `--force-dark-mode`. If you use it, run each call in the background, then stop the task and `pkill -f` its own `--user-data-dir`.
  - **What worked:** the plugin `chrome-devtools-mcp` → `new_page` with `isolatedContext` + `background: true` → `emulate` (`viewport: 400x900x2,mobile,touch`, `colorScheme: light|dark`) → `take_screenshot` inline. Its `filePath` rejects paths outside its workspace roots, so screenshot inline. Close the page afterwards.
- **A one-script responsive check beats eyeballing.** `evaluate_script` comparing `documentElement.scrollWidth` with `clientWidth`, plus walking elements whose right edge passes the viewport without an `overflow-x` ancestor, confirmed no page-level horizontal scroll at 400px in one call.
- Matched the palette and type scale of the earlier `2026-09-13-principles-briefing.html` for consistency across Gauntlet pages; the house style there reads well in both themes.
