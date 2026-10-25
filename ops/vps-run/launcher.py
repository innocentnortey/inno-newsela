#!/usr/bin/env python3
"""Newsela VPS launcher: one main Claude session, Phase A on Opus then Phase B on Sonnet.

What it does, concretely
------------------------
`run` checks the machine and the pinned workflow (preflight), starts Phase A with
`claude -p --model opus --session-id <fixed uuid>`, waits for that process to end (no polling
model calls), reads the run's stream-json log to verify the model that actually served it, then
runs the mechanical Phase A checkpoint (`checks/checkpoint_a.py`). If the checkpoint fails and
attempts remain, it resumes the *same* session with the list of failing checks. When the
checkpoint passes it switches: every project agent definition is pinned to Sonnet (backed up
first), subagents are forced to Sonnet through the documented environment variables, and Phase B
starts on `--model sonnet` with its own fixed session id. Phase B ends the same way, against
`checks/checkpoint_b.py`.

Nothing advances on a process exit or a completion sentence alone: only a passing checkpoint
moves the state forward. A budget stop, a served-model mismatch or exhausted attempts stop the
launcher with the state preserved and an exact resume path in `state/RESUME.md`.

Commands: preflight, lock, run, status, stop, verify-model. Python 3.10+, standard library only.
Decisions behind it: PRD PD-32 (standing authorization), PD-34 (VPS, Opus → Sonnet), PD-35 (budgets).
"""
from __future__ import annotations

import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]                      # inno-newsela/
WORKSPACE = ROOT.parent                     # /home/linuxuser/workspaces
STATE_DIR = HERE / "state"
LOG_DIR = HERE / "logs"
CKPT_DIR = HERE / "checkpoints"
PROMPTS = HERE / "prompts"
CONFIG = json.loads((HERE / "config.json").read_text())
LOCK_FILE = HERE / "workflow-lock.json"
STATE_FILE = STATE_DIR / "state.json"
RUN_LOCK = STATE_DIR / "launcher.lock"
LOG = LOG_DIR / "launcher.log"
CLAUDE = os.environ.get("CLAUDE_BIN", str(Path.home() / ".local/bin/claude"))

PHASES = {
    "A": {"model": "opus", "prompt": "phase-a-opus.md", "check": "checkpoint_a.py", "name": "newsela-phase-a"},
    "B": {"model": "sonnet", "prompt": "phase-b-sonnet.md", "check": "checkpoint_b.py", "name": "newsela-phase-b"},
}


# ---------------------------------------------------------------- small helpers
def now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log(msg: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"{now()} {msg}"
    print(line, flush=True)
    with LOG.open("a") as f:
        f.write(line + "\n")


def md5(path: Path) -> str | None:
    try:
        return hashlib.md5(path.read_bytes()).hexdigest()
    except (FileNotFoundError, IsADirectoryError):
        return None


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"created": now(), "phase": "A", "status": "not-started",
            "sessions": {"A": str(uuid.uuid4()), "B": str(uuid.uuid4())},
            "attempts": {"A": 0, "B": 0}, "spend_usd": {"A": 0.0, "B": 0.0},
            "passed": {"A": False, "B": False}, "child_pid": None, "history": []}


def save_state(st: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(st, indent=2))
    tmp.replace(STATE_FILE)


# ---------------------------------------------------------------- workflow lock
def lock_targets() -> list[Path]:
    """Files whose content defines Newsela's active workflow (pinned copies + inherited parents)."""
    t: list[Path] = []
    for base in (ROOT / ".claude/skills", ROOT / ".claude/workflow", ROOT / ".claude/agents", ROOT / ".claude/rules"):
        t += sorted(p for p in base.rglob("*") if p.is_file() and "__pycache__" not in p.parts
                    and ".pytest_cache" not in p.parts)
    t += [ROOT / "CLAUDE.md"]
    # Inherited from outside the repo: parent rules and CLAUDE.md load into every Newsela session.
    t += sorted((WORKSPACE / ".claude/rules").glob("*.md"))
    t += [WORKSPACE / "CLAUDE.md", Path.home() / ".claude/settings.json",
          Path.home() / ".claude/hooks/zero-to-hero-guard.py"]
    icm = Path.home() / ".claude/skills/icm-project"
    if icm.exists():
        t += sorted(p for p in icm.resolve().rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    return t


def rel(p: Path) -> str:
    for base, tag in ((ROOT, ""), (WORKSPACE, "WORKSPACE/"), (Path.home(), "HOME/")):
        try:
            return tag + str(p.relative_to(base))
        except ValueError:
            continue
    return str(p)


def write_lock(note: str) -> None:
    files = {rel(p): md5(p) for p in lock_targets()}
    data = {"written": now(), "note": note, "claude_version": claude_version(), "files": files}
    if LOCK_FILE.exists():
        hist = HERE / "state" / "lock-history"
        hist.mkdir(parents=True, exist_ok=True)
        shutil.copy2(LOCK_FILE, hist / f"workflow-lock-{now().replace(':', '')}.json")
    LOCK_FILE.write_text(json.dumps(data, indent=2, sort_keys=True))
    log(f"workflow lock written: {len(files)} files ({note})")


def lock_drift() -> list[str]:
    if not LOCK_FILE.exists():
        return ["no workflow-lock.json: run `launcher.py lock --note ...` first"]
    locked = json.loads(LOCK_FILE.read_text())["files"]
    current = {rel(p): md5(p) for p in lock_targets()}
    drift = [f"changed: {k}" for k in locked if k in current and current[k] != locked[k]]
    drift += [f"missing: {k}" for k in locked if k not in current]
    drift += [f"new: {k}" for k in current if k not in locked]
    return drift


# ---------------------------------------------------------------- preflight
def claude_version() -> str:
    try:
        return subprocess.run([CLAUDE, "--version"], capture_output=True, text=True, timeout=30).stdout.strip()
    except Exception as e:  # noqa: BLE001 - report, don't crash
        return f"unavailable: {e}"


def other_main_session(st: dict) -> list[str]:
    out = subprocess.run(["ps", "-eo", "pid,args"], capture_output=True, text=True).stdout
    ids = set(st["sessions"].values())
    return [l.strip() for l in out.splitlines() if "claude" in l and any(i in l for i in ids)]


def preflight(phase: str, accept_drift: bool = False) -> list[str]:
    st = load_state()
    problems: list[str] = []
    free_gb = shutil.disk_usage(ROOT).free / 1e9
    if free_gb < CONFIG["min_free_gb"]:
        problems.append(f"disk: {free_gb:.1f} GB free, need ≥ {CONFIG['min_free_gb']} GB")
    if not Path(CLAUDE).exists():
        problems.append(f"claude binary not found at {CLAUDE}")
    for tool in ("git", "glab", "node", "npm", "python3", "tmux"):
        if not shutil.which(tool):
            problems.append(f"tool missing: {tool}")
    r = subprocess.run(["git", "-C", str(ROOT), "remote", "get-url", "origin"], capture_output=True, text=True)
    if r.returncode != 0:
        problems.append("git origin not set")
    r = subprocess.run(["glab", "auth", "status", "--hostname", CONFIG["gitlab_host"]], capture_output=True, text=True)
    if r.returncode != 0:
        problems.append("glab is not authenticated for " + CONFIG["gitlab_host"])
    pe = WORKSPACE / "bin/with-provider-env"
    if not pe.exists() or subprocess.run([str(pe), "--check"], capture_output=True).returncode != 0:
        problems.append("shared provider keys not available (bin/with-provider-env --check failed)")
    running = other_main_session(st)
    if running:
        problems.append("a Newsela main session is already running: " + running[0][:120])
    drift = lock_drift()
    if drift and not accept_drift:
        problems.append("workflow drift since the lock (review, then `launcher.py lock --note ...` to accept): "
                        + "; ".join(drift[:8]) + (" …" if len(drift) > 8 else ""))
    if phase == "B" and not st["passed"]["A"]:
        problems.append("Phase A checkpoint has not passed")
    return problems


# ---------------------------------------------------------------- one run of a phase
def parse_stream(path: Path) -> dict:
    info = {"init_model": None, "result": None, "model_usage": {}, "cost": 0.0, "subtype": None}
    if not path.exists():
        return info
    for line in path.read_text(errors="replace").splitlines():
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("type") == "system" and ev.get("subtype") == "init":
            info["init_model"] = ev.get("model")
            info["init"] = {k: ev.get(k) for k in ("model", "permissionMode", "cwd", "session_id")}
            info["agents"] = ev.get("agents")
            info["skills"] = ev.get("skills")
        if ev.get("type") == "result":
            info["result"] = ev
            info["subtype"] = ev.get("subtype")
            info["cost"] = float(ev.get("total_cost_usd") or 0.0)
            info["model_usage"] = ev.get("modelUsage") or {}
    return info


def model_ok(phase: str, info: dict) -> list[str]:
    want = PHASES[phase]["model"]
    errs = []
    if not info["init_model"] or want not in str(info["init_model"]).lower():
        errs.append(f"served model at init was {info['init_model']!r}, expected {want}")
    if phase == "B":
        opus = [m for m in info["model_usage"] if "opus" in m.lower()]
        if opus:
            errs.append(f"Opus used during Phase B: {opus}")
    return errs


def pin_agents_to_sonnet() -> None:
    """Phase B transition: every project agent definition says `model: sonnet` (backup kept)."""
    agents = ROOT / ".claude/agents"
    backup = STATE_DIR / "agents-phase-a"
    if not backup.exists():
        shutil.copytree(agents, backup)
    for p in agents.glob("*.md"):
        lines = p.read_text().split("\n")
        if lines and lines[0].strip() == "---":
            end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
            if end:
                found = False
                for i in range(1, end):
                    if lines[i].startswith("model:"):
                        lines[i] = "model: sonnet"
                        found = True
                if not found:
                    lines.insert(end, "model: sonnet")
                p.write_text("\n".join(lines))
    log("agents pinned to Sonnet for Phase B (backup in state/agents-phase-a/); workflow lock re-recorded")
    write_lock("Phase B transition: agent models pinned to sonnet (PD-34)")


def run_once(phase: str, st: dict) -> dict:
    cfg = PHASES[phase]
    st["attempts"][phase] += 1
    n = st["attempts"][phase]
    out = LOG_DIR / f"phase-{phase.lower()}-run-{n}.jsonl"
    err = LOG_DIR / f"phase-{phase.lower()}-run-{n}.stderr.log"
    sid = st["sessions"][phase]
    if n == 1:
        prompt = (PROMPTS / cfg["prompt"]).read_text()
        session_args = ["--session-id", sid]
    else:
        last = json.loads((CKPT_DIR / f"phase-{phase.lower()}.json").read_text()) if (CKPT_DIR / f"phase-{phase.lower()}.json").exists() else {}
        failing = "\n".join(f"- {c}" for c in last.get("failed", [])) or "- (the previous run ended before the checkpoint could run)"
        prompt = (PROMPTS / "resume.md").read_text().replace("{PHASE_LOWER}", phase.lower()).replace("{PHASE}", phase).replace("{FAILING}", failing)
        session_args = ["--resume", sid]
    budget = CONFIG["phases"][phase]["per_run_budget_usd"]
    cmd = [CLAUDE, "-p", prompt, "--model", cfg["model"], *session_args, "--name", cfg["name"],
           "--output-format", "stream-json", "--verbose",
           "--permission-mode", CONFIG["permission_mode"], "--max-budget-usd", str(budget)]
    env = dict(os.environ)
    if phase == "B":
        env["CLAUDE_CODE_SUBAGENT_MODEL"] = "sonnet"
        env["CLAUDE_CODE_SUBAGENT_MODEL_FORCE"] = "1"
    log(f"phase {phase} run {n}: starting ({cfg['model']}, session {sid}, budget ${budget})")
    started = time.time()
    with out.open("w") as fo, err.open("w") as fe:
        proc = subprocess.Popen(cmd, cwd=ROOT, env=env, stdout=fo, stderr=fe, start_new_session=True)
        st["child_pid"] = proc.pid
        st["status"] = f"running phase {phase} run {n}"
        save_state(st)
        rc = proc.wait()
    st["child_pid"] = None
    info = parse_stream(out)
    st["spend_usd"][phase] = round(st["spend_usd"][phase] + info["cost"], 2)
    rec = {"phase": phase, "run": n, "rc": rc, "subtype": info["subtype"], "init_model": info["init_model"],
           "model_usage": list(info["model_usage"].keys()), "cost_usd": info["cost"],
           "minutes": round((time.time() - started) / 60, 1), "ended": now()}
    st["history"].append(rec)
    with (STATE_DIR / "metrics.jsonl").open("a") as f:     # workflow measurements from the logs, no AI calls
        f.write(json.dumps(rec) + "\n")
    save_state(st)
    log(f"phase {phase} run {n}: exit {rc}, subtype {info['subtype']}, model {info['init_model']}, "
        f"cost ${info['cost']:.2f}, models used {rec['model_usage']}")
    return info


def checkpoint(phase: str) -> bool:
    script = HERE / "checks" / PHASES[phase]["check"]
    out = CKPT_DIR / f"phase-{phase.lower()}.json"
    CKPT_DIR.mkdir(parents=True, exist_ok=True)
    r = subprocess.run([sys.executable, str(script), "--root", str(ROOT), "--out", str(out)],
                       capture_output=True, text=True, timeout=1800)
    log(f"checkpoint {phase}: exit {r.returncode}; " + (r.stdout.strip().splitlines() or ["(no output)"])[-1])
    return r.returncode == 0


def write_resume(st: dict, reason: str) -> None:
    ph = st["phase"]
    text = f"""# Newsela launcher stopped — {now()}

**Reason:** {reason}
**Phase:** {ph} · **attempts used:** {st['attempts'][ph]} of {CONFIG['phases'][ph]['max_runs']} ·
**spend so far (API-equivalent):** A ${st['spend_usd']['A']}, B ${st['spend_usd']['B']}
**Session ids:** A {st['sessions']['A']} · B {st['sessions']['B']}
**Last checkpoint:** `ops/vps-run/checkpoints/phase-{ph.lower()}.json`

## Resume (after fixing the reason above)

```bash
cd {ROOT}
python3 ops/vps-run/launcher.py status
bash ops/vps-run/run.sh            # restarts the launcher in tmux; it continues from this state
```
To allow more attempts or budget, edit `ops/vps-run/config.json` first (record why in the dev log).
To continue the session by hand instead: `{CLAUDE} --resume {st['sessions'][ph]} --model {PHASES[ph]['model']}`.
"""
    (STATE_DIR / "RESUME.md").write_text(text)
    log(f"stopped: {reason} (see ops/vps-run/state/RESUME.md)")


# ---------------------------------------------------------------- commands
def cmd_run(args) -> int:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    lockf = RUN_LOCK.open("w")
    try:
        fcntl.flock(lockf, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("another launcher holds the lock; use `launcher.py status`", file=sys.stderr)
        return 3
    st = load_state()
    save_state(st)
    for phase in ("A", "B"):
        if st["passed"][phase]:
            continue
        st["phase"] = phase
        if phase == "B" and st.get("transitioned") is not True:
            pin_agents_to_sonnet()
            st["transitioned"] = True
            save_state(st)
        probs = preflight(phase, accept_drift=args.accept_drift)
        if probs:
            st["status"] = f"blocked before phase {phase}"
            save_state(st)
            write_resume(st, "preflight failed: " + " | ".join(probs))
            return 2
        cfg = CONFIG["phases"][phase]
        while True:
            if st["attempts"][phase] >= cfg["max_runs"]:
                st["status"] = f"phase {phase} incomplete"
                save_state(st)
                write_resume(st, f"phase {phase} used all {cfg['max_runs']} runs without passing its checkpoint")
                return 1
            if st["spend_usd"][phase] >= cfg["total_budget_usd"]:
                st["status"] = f"phase {phase} budget reached"
                save_state(st)
                write_resume(st, f"phase {phase} reached its total budget ${cfg['total_budget_usd']}")
                return 1
            info = run_once(phase, st)
            bad = model_ok(phase, info)
            if bad:
                st["status"] = f"phase {phase} model mismatch"
                save_state(st)
                write_resume(st, "served-model check failed: " + "; ".join(bad))
                return 1
            if checkpoint(phase):
                st["passed"][phase] = True
                st["status"] = f"phase {phase} passed"
                save_state(st)
                log(f"phase {phase} checkpoint PASSED")
                break
            if info["subtype"] == "error_max_budget_usd":
                st["status"] = f"phase {phase} run budget reached"
                save_state(st)
                write_resume(st, f"a phase {phase} run hit its per-run budget before the checkpoint passed")
                return 1
            if info["subtype"] is None or info["subtype"].startswith("error"):
                wait = 60 * st["attempts"][phase]
                log(f"transient failure ({info['subtype']}); waiting {wait}s before resuming")
                time.sleep(wait)
    st["status"] = "complete"
    save_state(st)
    log("both phases passed their checkpoints: Newsela run complete")
    return 0


def cmd_status(args) -> int:
    st = load_state()
    print(json.dumps({k: st[k] for k in ("status", "phase", "passed", "attempts", "spend_usd", "sessions", "child_pid")}, indent=2))
    for ph in ("a", "b"):
        f = CKPT_DIR / f"phase-{ph}.json"
        if f.exists():
            c = json.loads(f.read_text())
            print(f"checkpoint {ph.upper()}: {'PASS' if c.get('passed') else 'FAIL'} — failing: {c.get('failed', [])[:6]}")
    if LOG.exists():
        print("--- launcher.log (last 10)\n" + "\n".join(LOG.read_text().splitlines()[-10:]))
    if (STATE_DIR / "RESUME.md").exists():
        print("--- RESUME.md exists: ops/vps-run/state/RESUME.md")
    return 0


def cmd_stop(args) -> int:
    st = load_state()
    pid = st.get("child_pid")
    if pid:
        try:
            os.killpg(pid, signal.SIGTERM)
            log(f"stop requested: SIGTERM sent to the Claude process group {pid}")
        except ProcessLookupError:
            log("stop requested: recorded child already gone")
    subprocess.run(["tmux", "kill-session", "-t", CONFIG["tmux_session"]], capture_output=True)
    st["child_pid"] = None
    st["status"] = f"stopped during phase {st['phase']}"
    save_state(st)
    write_resume(st, "stopped by the operator")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("preflight"); p.add_argument("--phase", default="A", choices=["A", "B"]); p.add_argument("--accept-drift", action="store_true")
    p = sub.add_parser("lock"); p.add_argument("--note", required=True)
    p = sub.add_parser("run"); p.add_argument("--accept-drift", action="store_true")
    sub.add_parser("status"); sub.add_parser("stop")
    p = sub.add_parser("verify-model"); p.add_argument("--phase", required=True, choices=["A", "B"]); p.add_argument("--log", required=True)
    a = ap.parse_args()
    if a.cmd == "preflight":
        probs = preflight(a.phase, a.accept_drift)
        print("PREFLIGHT OK" if not probs else "PREFLIGHT FAILED\n- " + "\n- ".join(probs))
        print(f"claude: {claude_version()} · free disk: {shutil.disk_usage(ROOT).free / 1e9:.1f} GB")
        return 0 if not probs else 1
    if a.cmd == "lock":
        write_lock(a.note); return 0
    if a.cmd == "run":
        return cmd_run(a)
    if a.cmd == "status":
        return cmd_status(a)
    if a.cmd == "stop":
        return cmd_stop(a)
    if a.cmd == "verify-model":
        info = parse_stream(Path(a.log)); bad = model_ok(a.phase, info)
        print(json.dumps({"init_model": info["init_model"], "models_used": list(info["model_usage"]),
                          "agents": info.get("agents"), "skills": info.get("skills"), "problems": bad}, indent=2))
        return 0 if not bad else 1
    return 2


if __name__ == "__main__":
    sys.exit(main())
