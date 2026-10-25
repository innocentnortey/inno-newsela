# Newsela VPS run — operator guide

One main Claude session does the work. **Phase A** runs on **Opus** until complete ticketing (all waves specified and
published) and the Sonnet handoff are done. **Phase B** runs on **Sonnet** (every subagent too) through delivery. A
small non-AI launcher (`launcher.py`) starts each phase, waits for it, verifies the model that actually served it, runs
the phase checkpoint and only then moves on. No AI process supervises another (PRD PD-34, PD-35).

## Start, watch, stop

```bash
ssh claude-vultr
cd /home/linuxuser/workspaces/inno-newsela
python3 ops/vps-run/launcher.py preflight      # optional: checks only, no model calls
bash ops/vps-run/run.sh                         # starts the launcher in tmux session "newsela-run"
```

| Do | Command |
|---|---|
| See progress | `python3 ops/vps-run/launcher.py status` |
| Watch live | `tmux attach -t newsela-run` (leave with Ctrl-b then d; the run keeps going) |
| Follow the log | `tail -f ops/vps-run/logs/launcher.log` |
| Stop | `python3 ops/vps-run/launcher.py stop` (stops the Claude process and tmux; state is kept) |
| Resume after a stop, a crash or a reboot | `bash ops/vps-run/run.sh` (continues from `state/state.json`; read `state/RESUME.md` first) |
| Continue a phase by hand instead | `~/.local/bin/claude --resume <session id from status> --model <opus or sonnet>` |

## How the phases end

| Event | What the launcher does |
|---|---|
| Phase ends, checkpoint passes | Phase A → pins agents to Sonnet, starts Phase B. Phase B → status `complete` |
| Phase ends, checkpoint fails | Resumes the **same** session with the failing list (`prompts/resume.md`), up to `max_runs` |
| A run errors (no result / error) | Waits 60 s × attempt, then resumes, within `max_runs` |
| Per-run or phase budget reached | Stops; `state/RESUME.md` says what to change |
| Served model wrong (or Opus used in Phase B) | Stops immediately |
| Workflow files changed since the lock | Refuses to start a phase until reviewed (`launcher.py lock --note "<why>"` accepts) |
| Disk below 2.5 GB, another Newsela session running, tools or logins missing | Refuses to start |

Budgets and attempts: `config.json` (Phase A ≤ $150/run, $300 total, 4 runs; Phase B ≤ $200/run, $600 total, 8 runs;
API-equivalent estimate). Checkpoints: `checks/checkpoint_a.py`, `checks/checkpoint_b.py` (run them any time with
`--root . --out /tmp/ck.json`).

## Where things are

| What | Path |
|---|---|
| Launcher | `ops/vps-run/launcher.py`, `ops/vps-run/run.sh`, `ops/vps-run/config.json` |
| Prompts | `ops/vps-run/prompts/phase-a-opus.md`, `phase-b-sonnet.md`, `resume.md` |
| Logs (stream-json per run) | `ops/vps-run/logs/phase-{a,b}-run-N.jsonl`, `launcher.log`, `launcher-console.log` |
| State and checkpoints | `ops/vps-run/state/state.json`, `state/metrics.jsonl`, `state/RESUME.md`, `checkpoints/phase-{a,b}.json` |
| Pinned workflow and its lock | `.claude/skills/`, `.claude/workflow/`, `.claude/agents/`, `.claude/rules/`; `ops/vps-run/workflow-lock.json` |
| Phase B handoff (written by Phase A) | `docs/plans/HANDOFF-PHASE-B.md` |

`state/`, `logs/` and `checkpoints/` are git-ignored.
