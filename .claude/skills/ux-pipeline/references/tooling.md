# Tooling (Claude's choice, 2026-10-18)

Innocent set the process; Claude chose the tools. Claims were checked on 2026-10-18 against each
project's own page. Re-check before relying on limits or prices, which change.

## Chosen

| Need | Tool | Why this one | Status |
|---|---|---|---|
| Flows, journeys, sitemap, sequences | **Mermaid** source in the Markdown; rendered to static SVG with `npx -p @mermaid-js/mermaid-cli mmdc -i x.mmd -o x.svg` and inlined into review pages | Text Claude can edit and Git can diff. Inline SVG keeps review pages free of external scripts (the checker forbids remote assets). MIT | Ready (Node 24 present) |
| Reference research | **Chrome DevTools MCP** in an isolated browser context (`isolatedContext: "<project>-ux"`) | Already connected, and the house rule prefers it. Screenshots at desktop and phone width, a11y snapshots, Lighthouse | Ready |
| Feel brief (before any search) | **Markdown** `docs/ux/02-concepts/FEEL_BRIEF.md`: who and in what state, 3–5 feel pairs, interaction shape, analogous products outside the industry, what to avoid → the search terms (2026-10-25) | Industry searches return what the industry ships today, often dated; analogous inspiration finds the same feel done well elsewhere (`references/phases.md` UX-2 step 0) | Ready |
| Reference sources (see *Reference sources* below) | Dribbble by default; Mobbin or Refero when Innocent has an account; Page Flows for flows | One source was too narrow (2026-10-25) | Ready (Dribbble); others: check access on first use |
| Design direction (visual style) | **Dribbble** (dribbble.com search) driven live in **Chrome DevTools MCP**, isolated context | Innocent's choice (2026-10-18): real, current product design is where good directions come from; rules alone produced a direction he rejected. Thumbnails lazy-load: read each shot's image URL from the page (or `og:image`) rather than screenshotting placeholders | Ready |
| Direction look sheets (every direction, first) | **Static HTML** per direction, `docs/artifacts/YYYY-MM-DD-<direction>-look-sheet.html`, written by a small Python generator in `docs/artifacts/_build/<direction>-look/` (starter: `templates/look_sheet_generator.py`; contents and checks: `templates/LOOK_SHEET.md`). Credited Dribbble references embedded as data URIs, light + dark swatches with contrast computed from the hex values, 3–4 static mockups on real flow copy; no JS | Innocent judges colour and feel in a minute (2026-10-20: "screenshots or fast light mockups before showing me so i can see the colors"). Minutes per direction, so every direction gets one. Worked example: `inno-aea-callcenter/docs/artifacts/_build/a4-look/build_a4_look.py` | Ready |
| Linked screens (optional, after the shortlist) | **Linked static screens**, standalone HTML per shortlisted direction in `docs/artifacts/`: the look sheet's CSS, a few representative screens, joined by plain links and `#screen` anchors; **no scripted engine** (no simulated chat, timers or state machine); embedded fonts, no external assets; under an hour per direction | Optional since pilot v2 (2026-10-25): a choice aid when the look sheets alone don't settle it, never a mandatory full application. It does not need the review-page checker | Ready |
| Concept variants | **Google Stitch** through its MCP server (`https://stitch.googleapis.com/mcp`) plus selected **stitch-skills** (`generate-design`, `enhance-prompt`, `design-md`, `taste-design`) | Fast, distinct screen variants from a description. Free with usage limits (Google Labs). The skills are Apache-2.0 and say "not an officially supported Google product" | **Connected 2026-10-18** (key in `Nortorious-Technologies/.env`; auth verified) |
| Concept fallback, wireframes | Claude-drawn low-fi HTML/SVG wireframes following the `ui-*` rules | No account and no outside service; always available. Also used whenever Stitch output needs correcting | Ready |
| Shared interface spec (UX-3a) | **`docs/contracts/`**: `INTERFACE.md` (CON cards) + **OpenAPI 3.1** `interface.openapi.yaml` + `CHANGES.md`; **Redocly CLI** lint + **Prism** mock and proxy (`@stoplight/prism-cli`, Apache-2.0) | Language-neutral while the stack is open; one file gives the generated types, the Prism mock the §8 frontend is built against, and the backend contract checks (`references/ui-contracts.md`) | Ready (via `npx`) |
| Frontend stack default (§8 and FW) | **React + Vite + TypeScript + shadcn/ui** (owned component source, Radix primitives) in the project's real frontend folder (e.g. `web/`); types generated from `docs/contracts/interface.openapi.yaml`; runs against the Prism mock while the backend is built | The house stack preference (UI-10); real, accessible components. Since pilot v2 (2026-10-25) this is the default for the FW foundation wave and §8 frontend tickets, **not** a UX-4 requirement; the stack and its decision source are recorded in `docs/plans/foundation-wave.md`. A project that departs from it records why | Created at FW / §8 |
| Repeatable verification | **Playwright Test ≥ 1.64** + **`@axe-core/playwright`** (WCAG 2.x A/AA tags) + `toHaveScreenshot` at 1280/390, light and dark; installed Chrome via `channel: "chrome"` | Interaction, accessibility and visual regression from one command. A screenshot pass says nothing about WCAG, so both run. **1.52 hangs on Node 24** before running any test (2026-10-19) — always run under a hard cap | Created at FW / §8 (UX-5a) |
| Traceability | `scripts/trace_check.py` (this skill) | REQ → US → FLOW → SCR → CON → TEST chain, checked without opinions | Ready |
| Gate pages | zero-to-hero visual review template, `stamp_review_page.py`, `check_review_page.py` | Same standard as Stages 1–3 | Ready |

## Deliberately not chosen (for the pilot)

| Tool | Why not now |
|---|---|
| Playwright **MCP** | Duplicates Chrome DevTools MCP for interactive work, and the global rule prefers DevTools. Playwright is used as a *test runner* instead, which gives repeatable evidence |
| Penpot (+ MCP) | Self-hosting a design platform is heavy for a 2–3-day build. Reconsider if long-lived editable design files become the need |
| Figma | Paid seats for canvas-writing MCP; not free-first |
| Storybook | Only once the frontend has enough reusable components to justify it; the FW component gallery covers the early need |
| Multiple standing subagents | One orchestrator first. Add a design-critic or QA subagent only when a gate shows the need |

## Data rules for outside tools

- Only **synthetic** content and PRD-derived descriptions go to Stitch (or any hosted tool): no real
  names, no real documents, nothing from a confidential brief. Riverside's brief is not confidential.
  YourAI's is, so it never goes to Stitch.
- Stitch-generated screens are **proposals**. They enter `CONCEPTS.md` with their prompt and date,
  and nothing generated is treated as a decision.
- Third-party skills are instructions Claude will follow. Read every installed `SKILL.md` before first
  use, and pin to a commit.

## Setup (one-time)

Stitch (Innocent's choice, 2026-10-18: the key lives in a `.env` file, not 1Password):
1. Sign in at stitch.withgoogle.com, then profile picture → **Stitch settings** → API key → **Create key**.
   This is a Stitch key, not a Gemini key. Menu names come from third-party guides and may drift.
2. Innocent pastes it into **`Nortorious-Technologies/.env`** as `STITCH_API_KEY=…`. That folder is
   not a git repo, the file is owner-only (600), and Claude never reads or prints the value.
3. Register the server once at user scope with a **`headersHelper`**. The helper is a command Claude
   Code runs at each connection; it reads the key from the `.env` and prints the header. Do not use a
   `${STITCH_API_KEY}` header reference: Claude Code sessions here are started by a background daemon
   from pre-warmed processes, which never see a terminal's environment, so the variable is empty.
   ```
   claude mcp add-json stitch '{"type":"http","url":"https://stitch.googleapis.com/mcp","headersHelper":"python3 -I /Users/innocentnortey/Desktop/Nortorious-Technologies/.claude/scripts/env-mcp-headers.py X-Goog-Api-Key=STITCH_API_KEY"}' -s user
   ```
4. Verify auth, not just connection. `/mcp` shows *Connected* without any key, so call
   `mcp__stitch__list_projects`. Without a key it returns HTTP 401. Verified 2026-10-18: a headless
   session with no key in its environment got OK through the helper. The Claude Code daemon keeps **one
   pre-started spare** and hands it to the next new session, then starts a replacement. The spare
   loads its server list when *it* starts. So after any MCP config change, the **first** new session
   still has the old list; the second one is fresh. Check `~/.claude/daemon.log` (`claimed-spare` /
   `spare spawned host pid=…`) against the change time. Seen 2026-10-18: the spare was pre-started at
   16:43:37, Stitch was registered at 16:44, and the 16:59 session had no Stitch.
5. Install only the needed skills into the project:
   `npx skills add google-labs-code/stitch-skills` (selective), then review each installed
   `SKILL.md`.
6. Known issue: one forum report says `generate_screen_from_text` rejected API keys while the
   other Stitch tools worked. If so, fall back to Claude-drawn wireframes.

Everything else runs from `npx` on demand; nothing is installed globally.

## Verified on this Mac (2026-10-18, Node 24)

| Tool | Version run | Note |
|---|---|---|
| mermaid-cli (`mmdc`) | latest via `npx -y -p @mermaid-js/mermaid-cli` | The SVG has no external references, but labels render as HTML `foreignObject`, which prints and scales badly. For review pages render with `-c mermaid.json` containing `{"htmlLabels":false,"flowchart":{"htmlLabels":false}}` — **mmdc 12 ignores the `flowchart`-only key; the top-level `htmlLabels` is what removes `foreignObject`** (verified 2026-10-18, grep the SVG for `foreignObject`). Pass `-I <unique-id>` per diagram (styles are scoped by SVG id, so two diagrams with the default id clash on one page) and render `-t default` and `-t dark` copies, switched by CSS — **with distinct ids per theme** (`-I dNNlt` / `-I dNNdk`; title ids `L`/`K`): both theme names start with "d", so ids derived from `theme[0]` collide and the dark stylesheet repaints the light copy black (2026-10-19). Check with `grep -o 'svg id="[^"]*"' page.html \| sort \| uniq -d` (prints nothing). Then add `role="img"` and a `<title>` to each inlined `<svg>` (the page checker requires both). **`journey` diagrams have no legible non-HTML mode** (`journey.textPlacement` `old` overlaps labels and drops section titles; `text` puts white labels on pale boxes): draw journeys on the page from the Mermaid source instead |
| Prism | 5.15.11 (`npx -y @stoplight/prism-cli`) | Runs; prints npm deprecation warnings for two transitive packages (harmless for local mocking) |
| Redocly CLI | 2.64.1 (`npx -y @redocly/cli`) | Runs |
| Playwright Test | 1.64.1 + `@axe-core/playwright` (2026-10-19, Node 24.14) | 1.52 hung forever, even on `--list`; 1.64.1 runs 52 tests in ~2 min with `--workers=3` |
| Page builders (Pillow) | `uv run --no-project --with pillow python scripts/review-pages/build_*.py` | No system or pyenv Python on this Mac has Pillow |
| Stitch MCP | remote `stitch.googleapis.com/mcp`, registered at user scope 2026-10-18 | Auth header comes from `headersHelper` → `.claude/scripts/env-mcp-headers.py`, which reads the root `.env`. `initialize` and `tools/list` answer **without** a key, so `claude mcp list` shows *Connected* even when the key is missing. Prove auth with a read-only `list_projects` call (HTTP 200, `isError: false` on 2026-10-18). 15 tools, incl. `generate_screen_from_text`, `generate_variants`, `edit_screens`, design-system tools. Screen generation is not yet tested (it uses quota; test at UX-2) |

## Reference sources (added 2026-10-25)

Checked 2026-10-25 by web search (third-party comparison pages, some published by competing vendors);
access, prices and catalogue sizes change, so check each on first use and record what you found here.

| Source | What it holds | Use it for | Access |
|---|---|---|---|
| **Dribbble** | Designers' concept shots | Texture, palette, polish; the default | Free, no account needed to search |
| **Mobbin** (mobbin.com) | Screens and user flows from real shipped apps, web and mobile | Modern patterns that actually ship; searchable by pattern and flow | Freemium; the free tier is limited; paid plans add an MCP server (beta) |
| **Refero** (refero.design) | Screens from real web products, with a style library (type, colour, spacing) | SaaS dashboards, settings, editors; strong for desktop web apps | Paid beyond a small free tier |
| **Page Flows** (pageflows.com) | Recorded user flows from real products | Step order and flow patterns, not texture | Paid |
| **Godly, Land-book, SaaS Pages** | Marketing and landing sites | A landing page only, never app UI | Free or freemium |

Use Mobbin or Refero only with Innocent's own account (sign-in follows `onepassword-login`), and only in
an isolated browser context. Never pay for or sign up to a source on his behalf.
