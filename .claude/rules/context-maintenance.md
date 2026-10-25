# Context Maintenance — Keep the Map True While You Work

Project-wide; read it on any task that creates, moves or renames a file, changes an owner, a route, a
boundary or a workflow. Set up 2026-10-24 by `icm-project` v1.5.0 (Phase 3). It is a work-time
instruction: nothing watches the repo in the background.

**Example.** A task adds `docs/data/worked-pairs.md`. In the same task: the router's §2 row changes
from *planned* to *exists*, the project checklist ticks its §2 row, the ICM checklist row it affects
(if any) gets the new evidence link, and the dev-log run file gets one short entry. Nothing else moves.

## In the same task as the change

1. **Fix the owner first.** When intent, a domain meaning, a boundary, a contract, a location or a
   workflow changes, update the record that owns it (brief register, PRD, decision table, design doc),
   then the router rows and rule `paths:` that point at it.
2. **Router rows route, they don't narrate.** Replace a link or state word; never append history.
   Planned paths stay labelled *planned* until the file exists; *in progress* means another agent owns it.
3. **The entry is not a map.** Never ask a task to keep a code map, progress, stage or decision list
   in the project entry. It changes only when the project's identity, a boundary or a route changes.
   Code locations go in `.claude/reference/area-map.md` (from Stage 6).
4. **ICM checklist** (`.claude/state/icm-progress.md`): when a code design, scaffold, slice or test
   changes what a route can be checked against, or a route is re-checked, replace the affected row's
   status and evidence link (≤ one sentence). It tracks context maturity, not tickets or product status.
5. **Product status lives elsewhere:** stages and gates in `PROJECT-CHECKLIST.md`, tickets in GitLab
   (once it exists), deliverables in `SUBMISSION.md`.
6. **Dev log** (`docs/devlog/`): one file per run, `YYYY-MM-DD-<topic>-<run-id>.md`, one writer per
   file. Add an entry (Changed · Why · Checked · Remaining; ~50–100 words) at each meaningful outcome,
   decision, failure, blocker or handoff. Workers return notes to the writer; they never share a file.
7. **Link conclusions to evidence.** Say *proposed*, *approved*, *implemented* or *verified* as
   it actually is; a scaffold or a plan proves nothing works.
8. **Copied rules:** change the original (named in each provenance line) first, then re-copy, keeping
   local adaptations written as a *Local adaptation* line.
9. **Reopen, don't patch around.** If a change invalidates the brief audit, PRD or design, say so and
   reopen that stage's question with Innocent.
10. **Hand off.** Before stopping, update `.claude/state/resume.md` with the next action.

## Check before finishing

- `python3 ~/.claude/skills/icm-project/scripts/check_context.py <repo>` reports no FAIL.
- Every link you added resolves, or is labelled planned / in progress.
