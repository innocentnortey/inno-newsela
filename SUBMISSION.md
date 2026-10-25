# Submission tracker — Newsela Lesson Studio

Newsela hiring-partner project via Gauntlet AI. Brief: *Lesson Content Generation and
Editing/Approval Workflow* (v1, last updated 2026-10-19; received 2026-10-24), issued copy in
[`docs/source/`](docs/source/). Submission is made from the Gauntlet portal page ("Submit directly
from this page. Your submission is tied to this project version").

| Field | Value |
|---|---|
| Due | Tue 2026-10-27 03:00 CT ("Monday night at 3 am", Innocent 2026-10-24; read as the end of Monday night, if he meant early Monday 2026-10-26 03:00 the runway is a day shorter) |
| Technical contact | andrew.parker@newsela.com (named in the brief for questions or link-access problems; **do not email without Innocent's say-so**) |
| Source repo | GitLab `git@labs.gauntletai.com:innocentnortey/inno-newsela.git`: **not created yet** (Innocent creates it) |
| Deployed app | Render (Gauntlet default; the brief allows AWS or a lighter host such as Vercel or Railway): not deployed yet |

Update a row as its evidence lands; walk the whole table at each checkpoint and before submitting.

| Deliverable | What the brief says | Where our evidence will live | Status |
|---|---|---|---|
| Source Code | Required. "Clean, well structured architecture." Stack: JavaScript (Next/Node), React, Python if desired; OpenAI or Anthropic APIs; ProseMirror and Yjs for the collaborative editor | GitLab `innocentnortey/inno-newsela` (`main`); GitHub mirror only as the Render deploy path | not started (repo scaffolded 2026-10-24, no code) |
| Technical Documentation | Required. No format given | `README.md` (run + deploy) and `docs/ARCHITECTURE.md` (planned), drawing on `docs/design/` and the PRD `docs/prd/newsela-prd.md` | not started |
| Demo Video | Required. No length given | `docs/artifacts/YYYY-MM-DD-demo-video.mp4` (planned); script and decision inventory in `docs/delivery/` per [hiring-partner-framing](.claude/rules/hiring-partner-framing.md) | not started |
| AI Usage Documentation | Optional; we include it | `docs/AI-USAGE.md` (planned), drawing on [`docs/devlog/`](docs/devlog/README.md) | not started |

## What each functional requirement must show (from the brief, for the demo and docs)

| Brief requirement | Shown by | Status |
|---|---|---|
| Generate a whole unit (~40 lessons) from an uploaded unit-outline Google Sheet | demo + docs | not started |
| Each lesson ~50 min, aligned to the CA Core ELA/ELD standards in the sheet, in Newsela's lesson structure (Launch, Learning In Action, Look Back, …) | demo + docs | not started |
| Upload UI to start generation (bonus: editable prompt, live view of generation) | demo | not started |
| Persist and track generated lessons for edit → approve → publish | demo + docs | not started |
| WYSIWYG review and edit, with AI-assisted tools | demo | not started |
| Approval workflow per lesson within a unit (flag complete) | demo | not started |
| Async generation (minutes per lesson is fine); rest of workflow performant for 20+ reviewers | docs (load reasoning) | not started |
