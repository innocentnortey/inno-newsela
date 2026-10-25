"""Run one launcher turn as a Claude Code *background session* (`claude --bg`), so it is a real session.

What it gives the operator: the run appears in `claude agents` with an id, and `claude attach <name>` opens it live
(he can watch or type into it; the run keeps going when he detaches). What the launcher keeps: a non-AI wait, the
served-model check and a usage log, read from the session transcript instead of `-p`'s stream-json result.

Facts this relies on (measured on the VPS, Claude Code 2.1.310, 2026-10-25):
- `claude --bg ... "<prompt>"` prints `backgrounded · <id> · <name>`; the folder must be trusted.
- `claude agents --json` lists the session by `sessionId`; a finished turn reads `status: idle, state: done`.
- A plain shell variable did not reach the session; `CLAUDE_CODE_SUBAGENT_MODEL` did. The FORCE flag is therefore
  re-checked from the transcript models every poll, not assumed.
- Transcripts: `~/.claude/projects/<cwd with / as ->/<sessionId>.jsonl` and `<sessionId>/subagents/*.jsonl`; each
  assistant line carries `message.model` and `message.usage`, but no cost.
- `--bg` ignores `--session-id`: a fresh session gets its own id (read back from `claude agents`); `--resume <id>`
  continues the given id.
- Cost is an API-equivalent *estimate*: per-model token rates fitted to Claude Code's own `costUSD` from this
  project's print-mode runs (Opus within 1% over 6 points; Sonnet fitted on 3 points, unvalidated). Billing is a
  subscription, so it is logged as usage only; there is no dollar cap (Innocent, 2026-10-25: "we dont need to
  worry about a budget im on a subscription").
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import time
from pathlib import Path

# $ per token, fitted 2026-10-25 (see module docstring). Input tokens are negligible here and priced as cache writes.
RATES = {
    "opus": {"out": 9.826e-6, "cache_read": 0.192e-6, "cache_write": 8.027e-6},
    "sonnet": {"out": 2.383e-6, "cache_read": 0.142e-6, "cache_write": 3.646e-6},
    "haiku": {"out": 2.383e-6, "cache_read": 0.142e-6, "cache_write": 3.646e-6},   # never expected; priced as Sonnet
}


def transcript_dir(cwd: Path) -> Path:
    return Path.home() / ".claude/projects" / re.sub(r"[^A-Za-z0-9]", "-", str(cwd))


def _rows(path: Path):
    try:
        with path.open(errors="replace") as f:
            for line in f:
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        return


def usage_since(cwd: Path, session_id: str, since_iso: str) -> dict:
    """Models and estimated cost of assistant messages written at or after `since_iso` (main + subagents)."""
    base = transcript_dir(cwd)
    files = [base / f"{session_id}.jsonl"] + sorted((base / session_id / "subagents").glob("*.jsonl"))
    replies: dict[str, tuple[str, dict]] = {}      # message id -> (model, max of each usage field)
    first_model = None
    for f in files:
        for e in _rows(f):
            if e.get("type") != "assistant" or (e.get("timestamp") or "") < since_iso:
                continue
            m = e.get("message") or {}
            model = m.get("model") or "unknown"
            if f.name.startswith(session_id) and first_model is None:
                first_model = model
            key = f.name + ":" + (m.get("id") or e.get("uuid") or "")   # one reply is written as several lines
            u = m.get("usage") or {}
            _, best = replies.get(key, (model, {}))
            for k in ("output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "input_tokens"):
                best[k] = max(best.get(k, 0), u.get(k, 0) or 0)
            replies[key] = (model, best)
    models: dict[str, float] = {}
    for model, u in replies.values():
        r = next((v for k, v in RATES.items() if k in model), RATES["opus"])
        cost = (u["output_tokens"] * r["out"] + u["cache_read_input_tokens"] * r["cache_read"]
                + (u["cache_creation_input_tokens"] + u["input_tokens"]) * r["cache_write"])
        models[model] = models.get(model, 0.0) + cost
    return {"init_model": first_model, "model_usage": models, "cost": round(sum(models.values()), 2)}


def agents(claude: str) -> list[dict]:
    r = subprocess.run([claude, "agents", "--json", "--all"], capture_output=True, text=True, timeout=60)
    try:
        return json.loads(r.stdout or "[]")
    except json.JSONDecodeError:
        return []


def find(claude: str, short_id: str) -> dict | None:
    """The background session with this short id (what `claude --bg` printed)."""
    return next((x for x in agents(claude) if x.get("id") == short_id), None)


def live_with_session(claude: str, session_id: str) -> dict | None:
    """Any live session (interactive or background) holding this session id."""
    return next((x for x in agents(claude) if x.get("sessionId") == session_id
                 and x.get("state") not in ("done", "stopped", "failed")), None)


def retire(claude: str, session_id: str, cwd: Path, backup_dir: Path, log) -> None:
    """Before `--resume`: stop and remove earlier background entries of this session, so the resumed session keeps
    the same id and name (measured: after a plain stop, --resume starts a copy under a new id). `rm` also deletes a
    session's worktree; Newsela's background sessions have none (worktree.bgIsolation is "none" on the VPS), and the
    transcript is copied to `backup_dir` first."""
    for row in agents(claude):
        if row.get("sessionId") != session_id or row.get("kind") != "background" or not row.get("id"):
            continue
        if Path(row.get("cwd") or "") != cwd:
            continue
        if row.get("state") not in ("done", "stopped", "failed"):
            stop(claude, row["id"])
            time.sleep(5)
        src = transcript_dir(cwd) / f"{session_id}.jsonl"
        if src.exists():
            backup_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, backup_dir / f"{session_id}-{int(time.time())}.jsonl")
        r = subprocess.run([claude, "rm", row["id"]], capture_output=True, text=True, timeout=120)
        log(f"retired background entry {row['id']} before resume: {(r.stdout + r.stderr).strip()[:160]}")


def stop(claude: str, short_id: str) -> None:
    subprocess.run([claude, "stop", short_id], capture_output=True, text=True, timeout=120)


def start(claude: str, cwd: Path, env: dict, args: list[str], prompt: str) -> tuple[str, str]:
    """Start a background session; return (short id, session id). `--bg` ignores `--session-id` (measured
    2026-10-25), so a fresh session gets its own id and the caller records it; `--resume <id>` keeps the id."""
    r = subprocess.run([claude, "--bg", *args, prompt], cwd=cwd, env=env, capture_output=True, text=True, timeout=180)
    m = re.search(r"backgrounded\s*·\s*([0-9a-f]{6,})", r.stdout + r.stderr)
    if not m:
        raise RuntimeError(f"claude --bg did not start a session: {(r.stdout + r.stderr).strip()[:300]}")
    short = m.group(1)
    for _ in range(12):
        row = find(claude, short)
        if row and row.get("sessionId"):
            return short, row["sessionId"]
        time.sleep(5)
    raise RuntimeError(f"background session {short} never appeared in `claude agents`")


def wait(claude: str, cwd: Path, short_id: str, session_id: str, since_iso: str, *, max_hours: float,
         forbid: tuple[str, ...], poll_s: int, log) -> dict:
    """Wait for the turn to end (state done, stopped or failed). Stops the session on a forbidden model or
    the wall-clock cap. Bounded. Cost is logged as a usage estimate only (subscription; no dollar cap)."""
    deadline = time.time() + max_hours * 3600
    last_note = 0.0
    while True:
        row = find(claude, short_id)
        u = usage_since(cwd, session_id, since_iso)
        bad = [m for m in u["model_usage"] if any(f in m for f in forbid)]
        if bad:
            stop(claude, short_id)
            return {**u, "subtype": "error_model", "detail": f"forbidden model served: {bad}"}
        state = (row or {}).get("state")
        if row is None or state in ("done", "stopped", "failed"):
            sub = "success" if state == "done" else f"error_{state or 'missing'}"
            return {**u, "subtype": sub, "detail": f"turn ended (state {state})"}
        if time.time() >= deadline:
            stop(claude, short_id)
            return {**u, "subtype": "error_timeout", "detail": f"TIMED OUT after {max_hours} h"}
        if time.time() - last_note >= 1800:
            log(f"bg session {short_id}: {row.get('status')}, usage estimate ${u['cost']}, models {list(u['model_usage'])}")
            last_note = time.time()
        time.sleep(poll_s)
