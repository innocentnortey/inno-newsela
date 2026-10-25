# Modern UI Principles for Web Apps (2025–2026)
*Compiled from top full-stack engineers, design engineers, and Claude Code best practices*
*Sources: @jasonlbeggs, @AdhamDannaway, @shadcn, Claude Cookbook / frontend_aesthetics, community Claude Code skills, Linear/Stripe/Vercel aesthetic references*

## Core Philosophy (Modern Era)
- **Clarity over decoration** — Clean layouts, deliberate spacing, minimal cognitive load.
- **Less is more** — Remove anything that does not earn its place. If it’s not essential for a specific view/state, remove or combine it.
- **Performance is aesthetics** — A slow interface looks worse than an imperfect one. Optimize for INP, View Transitions, and instant feedback.
- **Avoid AI Slop** — Never default to Inter/Roboto/Arial, purple gradients on white, rounded cards everywhere, or cookie-cutter layouts.
- **Design systems first** — Own your components (shadcn/ui style). Tokens > components. CSS variables for theming.
- **Accessibility from day one** — WCAG 2.2 baseline, keyboard, focus states, reduced motion, 4.5:1 contrast, 44×44px touch targets.

## 1. Visual Hierarchy & Layout
- Use size, weight, color, and spacing to establish clear importance (squint test: main action still visible when details blur).
- Proximity principle: related elements closer together; unrelated further apart.
- Consistent spacing scale (4px or 8px grid). Never arbitrary gaps.
- Mobile-first + container queries (prefer over media queries for true component responsiveness).
- Bento / modular grids for modern SaaS dashboards.
- One primary CTA per view. Secondary actions visually quieter.

## 2. Typography
- Choose distinctive, beautiful fonts. Avoid Inter, Roboto, Open Sans, Arial, system defaults.
- Good modern choices: Space Grotesk / JetBrains Mono (dev tools), Playfair / Crimson Pro (editorial), Geist, Satoshi, or carefully selected variable fonts.
- Ideal line length: 40–80 characters.
- Clear type scale with consistent ratios.
- `antialiased` on body for smoother rendering.
- Strong hierarchy: oversized display headings + small-caps or muted labels.

## 3. Color & Theme
- Commit to a cohesive aesthetic. Dominant color + sharp accent > timid evenly distributed palette.
- Use CSS variables / design tokens for everything (colors, spacing, radii, shadows).
- Dark-mode first (or at least design both from the start). OLED-friendly.
- High contrast: text ≥ 4.5:1, UI elements ≥ 3:1.
- Avoid clichéd purple gradients on white backgrounds.

## 4. Spacing, Alignment & Rhythm
- Space based on relatedness (Gestalt proximity).
- Perfect alignment. “Almost aligned” feels worse than completely misaligned.
- Consistent padding inside cards/components.
- Generous whitespace for breathing room (soft minimalism).

## 5. Interaction & Motion
- Motion should explain hierarchy and provide feedback, not decorate.
- Prefer CSS-only solutions (View Transitions, scroll-driven animations, `@starting-style`).
- High-impact moments: one well-orchestrated page load with staggered reveals > scattered micro-interactions.
- Duration: 150–300 ms for most UI transitions. Natural easing.
- Respect `prefers-reduced-motion`.
- Clear hover, focus, active, loading, empty, and error states for every interactive element.
- Cursor: `pointer` only on true navigation links; obvious hover states on other interactive elements.

## 6. Components & States (Critical for Claude)
Always implement and design for:
- Default
- Hover / Focus
- Active / Pressed
- Loading (skeleton or subtle spinner)
- Empty state (helpful, not “Nothing here”)
- Error / Validation (constructive, specific, positive tone)
- Disabled
- Success / Feedback after action

Use semantic HTML + ARIA. Prefer native elements (dialog, popover, details) when possible.

## 7. Modern Technical Foundations (What Top Engineers Use with Claude)
- Tailwind CSS + CSS variables / design tokens
- shadcn/ui (or equivalent owned components) + Radix for accessibility
- Container queries, `:has()`, relative colors, `text-wrap: balance`
- View Transitions API
- Framer Motion / Motion only when CSS is insufficient
- Semantic structure so the interface is also AI-readable

## 8. Anti-Patterns to Explicitly Avoid (Claude-specific)
- Generic “AI slop” aesthetic
- Overused fonts (Inter family especially)
- Predictable card grids with identical rounded corners and soft shadows
- Purple/blue gradients on light backgrounds
- Invisible primary buttons or low-contrast text
- Missing empty/loading/error states
- Inconsistent spacing or alignment across screens
- Building 15 screens at once instead of one polished screen at a time

## 9. Process Recommended by Top Engineers Using Claude Code
1. Create a `design.md` (or DESIGN.md) as single source of truth before writing code.
2. Define: feeling/aesthetic, audience, typography, colors, spacing scale, tokens, do’s/don’ts.
3. Build section-by-section or screen-by-screen.
4. Use browser/computer-use tools to inspect real states.
5. Document successful patterns and turn them into reusable skills.
6. Iterate on one design dimension at a time (typography → color → motion → backgrounds).

## 10. Quick Mental Checklist Before Shipping Any Screen
- [ ] Squint test passes
- [ ] One clear primary action
- [ ] All states handled (loading/empty/error)
- [ ] Keyboard + screen-reader friendly
- [ ] Consistent spacing & alignment
- [ ] Distinctive (not generic) aesthetic
- [ ] Fast (perceived performance)
- [ ] Mobile + desktop parity
