# Feel brief — Newsela Lesson Studio (UX-2 step 0)

**Owner of:** what the product must feel like, and the search terms UX-2's reference research uses.
**Written:** 2026-10-25 by Claude, from the [PRD v1.0](../../prd/newsela-prd.md) (§3 personas, §5.1 journey, GR-16),
the [hard-problem register](../../design/hard-problems.md), the [worked pairs](../../data/worked-pairs.md) and the
[company profile](../../analysis/2026-10-24-newsela-company-profile.md). **Status:** proposal (UX-2 is signed at its gate).

**The idea, in one line.** What a reviewer's workspace must *feel* like comes from the people using it and what is at
stake. It does not come from what education software usually looks like, which is often dated (LMS grey, clip-art,
primary colours). So we search for the feel and the interaction shape in other industries that do it well, and use
the education domain only for content: real lesson copy, real standards codes.

## 1. Who, where, in what state?

| Persona (PRD §3) | Where and when | State of mind |
|---|---|---|
| **Reviewer** (P-1, primary; a Learning Experience Designer) | Desktop, long focused sessions, one ~3,300-word lesson at a time (PRD §4), 20+ colleagues working the same unit | Expert and careful. Under an adoption deadline. Wary that AI is meant to replace them (F-17; GR-16: "never 'AI replaces writers'"). Wants to see *why* each issue is flagged |
| **Outline author** (P-2, instructional designer) | Desktop, a short burst: upload a sheet, read a validation report of 47 rows, start a run, watch it | Precise. Wants every problem in their sheet shown plainly before money is spent |
| **Approver** (P-3, content lead) | Desktop, many short visits: open a submitted lesson, read the checklist and evidence, approve or send back | Accountable to the state review. Needs confidence that what they approve is exactly what they saw |

## 2. What must it feel like? (feel pairs)

Each pair names where the product sits, and why.

| Pair | Position | Why |
|---|---|---|
| calm ↔ urgent | **calm** | Long reading sessions; an alarm-heavy screen tires a reviewer and hides the one issue that matters |
| editorial ↔ dashboard | **editorial first**, dashboard second | The lesson text is the work; the tool frames it. Boards and queues exist to get the reviewer to the text |
| expert tool ↔ consumer app | **expert tool, but warm** | Reviewers are professionals (keyboard, density, precision); they are also teachers at heart, and the product must not feel cold or machine-made (GR-16) |
| dense ↔ airy | **dense where scanning, airy where reading** | The validation report and triage queue are scanned (47 rows); the lesson is read |
| evidence ↔ verdict | **evidence visible** | Never a bare "aligned" badge (GR-4); every flag shows its source; approval shows what was pinned |

**In five words:** calm, editorial, expert, warm, accountable.

## 3. Interaction shape (named generically)

1. **Import and validate:** upload a spreadsheet, see row-by-row errors and warnings with proposed fixes, confirm.
2. **Job progress board:** many items moving through states (queued → drafting → checking → ready / failed).
3. **Triage queue:** a list sorted by what needs attention, filterable by state.
4. **Document editor with an evidence side pane:** rich text, live co-editing presence, suggestions to accept or
   reject, issues that jump to their spot.
5. **Review and approve a version:** a checklist with evidence, a frozen version, approve or request changes.
6. **A single metric tile:** a median with its *n* and a guard metric beside it.

## 4. Who already delivers this feel, outside education?

| Analogous product or domain | What it shares with us | Shape it covers |
|---|---|---|
| Code review (pull-request review screens) | Approve a specific version; blocking checks; "changes requested" | 5 |
| Issue trackers built for calm focus (Linear-style) | Dense, keyboard-first triage that still feels calm | 2, 3 |
| Collaborative document editors with suggestion mode and comment sidebars | Edit a long text together; accept or reject suggestions | 4 |
| Writing assistants with a side panel of issues (Grammarly-style) | Each flag points at a span and explains itself | 4 |
| Deployment dashboards (Vercel-style build lists) | Jobs moving through states, logs on demand, retry failed | 2 |
| Data import and cleanup tools (CSV importers, Airtable-style) | Row-level errors with proposed fixes before commit | 1 |
| Editorial CMS review workflows (headless CMS publishing) | Draft → review → publish with roles | 3, 5 |
| Reading apps with strong typography | Long-form reading comfort | 4 |

## 5. What must we avoid?

- **Dated ed-tech tells:** LMS grey chrome, clip-art icons, cartoon mascots, primary-colour palettes, crowded
  toolbars.
- **Alarm everywhere:** red reserved for the blocking issues that stop Approve.
- **AI sparkle:** purple-gradient "magic" buttons; AI help is one quiet, labelled tool (R-31).
- **The house Claude texture:** cream canvas, serif headings, outlined pills, sage accents (ux-pipeline house-texture
  check).

## Search terms (style searches never use "education", "edtech", "lesson", "school" or "curriculum")

| Shape | Terms |
|---|---|
| 1 Import and validate | "csv import validation web app", "data import errors table ui", "spreadsheet upload review" |
| 2 Progress board | "deployment dashboard", "job queue status ui", "build pipeline dashboard" |
| 3 Triage | "issue tracker web app", "triage inbox dashboard", "review queue saas" |
| 4 Editor + evidence | "document editor comments sidebar", "writing app suggestions panel", "collaborative editor web app" |
| 5 Review and approve | "code review ui", "approval workflow web app", "content review dashboard" |
| Overall feel | "calm saas dashboard", "editorial web app", "minimal productivity app", "warm minimal dashboard" |

**Content-only searches (labelled, not for style):** the education domain's terms and structures come from the
issued sources (`docs/source/`), not from searches.

**Sources** (ux-pipeline `references/tooling.md` → *Reference sources*): Dribbble first. Mobbin and Refero only with
Innocent's own account; none is set up for this project, so this run uses Dribbble plus public pages.
