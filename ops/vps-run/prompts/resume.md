Continue Phase {PHASE} of Newsela Lesson Studio from where you stopped. The launcher ran the phase checkpoint and it did
not pass. These checks are failing:

{FAILING}

Re-read `PROJECT-CHECKLIST.md`, `.claude/state/resume.md` and the latest file in `docs/devlog/` first, then fix the
failing items without redoing finished work. The original phase instructions still apply in full (standing decisions,
Innocent's standing authorization PD-32, models, budgets, privacy, honest labelling of human-only evidence). Run the
checkpoint yourself before you stop: `python3 ops/vps-run/checks/checkpoint_{PHASE_LOWER}.py --root . --out /tmp/ck.json`.
If an item is truly blocked by something only Innocent can do, write the blocker and the exact action he must take in
`.claude/state/resume.md` and the dev log, finish everything else, and stop.
