#!/usr/bin/env python3
"""Adopt *released* shared-workflow updates into Newsela's pinned copies, at a boundary, with rollback.

What it does: HX-R1 (or any session that owns a shared workflow file) lists a finished, data-backed change in
the shared release manifest `WORKSPACE/.claude/releases/workflow-releases.json`. At a phase start the launcher
runs `apply`; in Phase B the main session runs it at a wave boundary. Each released file is copied into
Newsela's pinned copy, keeping Newsela's provenance / local-adaptation header (rules) or `model:` line
(agents). Edits still being experimented on are never picked up: an entry is adopted only while the shared
file's md5 equals the md5 the entry released.

    python3 ops/vps-run/adopt_updates.py status
    python3 ops/vps-run/adopt_updates.py apply --boundary "phase B start"
    python3 ops/vps-run/adopt_updates.py rollback <adoption id>

Release entry: {"id": "R-3", "file": ".claude/rules/x.md" (workspace-relative), "md5": "...",
"status": "released", "basis": "<evidence path or result>", "released_by": "...", "released_at": "..."}
Records: `ops/vps-run/adopted.json` and `ops/vps-run/WORKFLOW-UPDATES.md` (tracked); backups in
`ops/vps-run/state/adopt-backups/<id>/`. Decision: PD-34 (Innocent, 2026-10-25: updates are fine when they are
"based on data and not something its currently experimenting").
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WORKSPACE = ROOT.parent
MANIFEST = WORKSPACE / ".claude/releases/workflow-releases.json"
ADOPTED = HERE / "adopted.json"
JOURNAL = HERE / "WORKFLOW-UPDATES.md"
BACKUPS = HERE / "state/adopt-backups"

# shared path prefix (workspace-relative) -> pinned prefix (repo-relative)
MAP = [
    (".claude/rules/", ".claude/rules/"),
    (".claude/agents/", ".claude/agents/"),
    (".claude/skills/zero-to-hero/", ".claude/skills/zero-to-hero/"),
    (".claude/skills/ux-pipeline/", ".claude/skills/ux-pipeline/"),
    ("Gauntlet AI/.claude/skills/to-tickets/", ".claude/workflow/to-tickets/"),
    ("Gauntlet AI/.claude/skills/system-design-readiness/", ".claude/workflow/system-design-readiness/"),
]


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def md5(p: Path) -> str | None:
    try:
        return hashlib.md5(p.read_bytes()).hexdigest()
    except FileNotFoundError:
        return None


def pinned_for(shared_rel: str) -> Path | None:
    for src, dst in MAP:
        if shared_rel.startswith(src):
            return ROOT / (dst + shared_rel[len(src):])
    return None


def merged(shared_text: str, pinned: Path) -> str:
    """Shared content, keeping what Newsela added to its pinned copy."""
    old = pinned.read_text() if pinned.exists() else ""
    if pinned.suffix != ".md" or not old:
        return shared_text
    if "/agents/" in str(pinned):
        m = re.search(r"^model:.*$", old, re.M)
        return re.sub(r"^model:.*$", m.group(0), shared_text, count=1, flags=re.M) if m else shared_text
    if "/rules/" in str(pinned) and old.startswith(">"):
        header = old[: old.index("\n# ") + 1] if "\n# " in old else ""
        body = shared_text[shared_text.index("# "):] if shared_text.startswith("# ") else \
            shared_text[shared_text.index("\n# ") + 1:] if "\n# " in shared_text else shared_text
        return header + body
    return shared_text


def load(p: Path, default):
    return json.loads(p.read_text()) if p.exists() else default


def pending() -> tuple[list[dict], list[str]]:
    rel = load(MANIFEST, {"releases": []})["releases"]
    done = load(ADOPTED, {})
    todo, notes = [], []
    for r in rel:
        if r.get("status") != "released" or r["id"] in done:
            continue
        shared = WORKSPACE / r["file"]
        pin = pinned_for(r["file"])
        if pin is None:
            notes.append(f"{r['id']}: {r['file']} is not part of Newsela's pinned workflow; ignored")
        elif md5(shared) != r["md5"]:
            notes.append(f"{r['id']}: {r['file']} changed after it was released (now {md5(shared)}); "
                         "waiting for a new release entry")
        else:
            todo.append({**r, "pinned": str(pin.relative_to(ROOT))})
    return todo, notes


def cmd_status(_a) -> int:
    todo, notes = pending()
    print(f"manifest: {MANIFEST} ({'present' if MANIFEST.exists() else 'absent'})")
    for t in todo:
        print(f"PENDING {t['id']}: {t['file']} -> {t['pinned']} (basis: {t.get('basis', '?')})")
    for n in notes:
        print(f"NOTE {n}")
    done = load(ADOPTED, {})
    print(f"{len(todo)} pending, {sum(1 for v in done.values() if not v.get('rolled_back'))} adopted, "
          f"{sum(1 for v in done.values() if v.get('rolled_back'))} rolled back")
    return 0


def cmd_apply(a) -> int:
    todo, notes = pending()
    for n in notes:
        print(f"NOTE {n}")
    if not todo:
        print("nothing to adopt")
        return 0
    done = load(ADOPTED, {})
    lines = []
    for t in todo:
        pin = ROOT / t["pinned"]
        bdir = BACKUPS / t["id"]
        bdir.mkdir(parents=True, exist_ok=True)
        if pin.exists():
            shutil.copy2(pin, bdir / pin.name)
        pin.parent.mkdir(parents=True, exist_ok=True)
        pin.write_text(merged((WORKSPACE / t["file"]).read_text(), pin))
        done[t["id"]] = {"file": t["file"], "md5": t["md5"], "pinned": t["pinned"], "at": now(),
                         "boundary": a.boundary, "basis": t.get("basis"), "backup": str(bdir.relative_to(ROOT)),
                         "existed": (bdir / pin.name).exists()}
        lines.append(f"| {t['id']} | {now()} | {a.boundary} | `{t['pinned']}` | {t.get('basis', '')} |")
        print(f"ADOPTED {t['id']}: {t['pinned']}")
    ADOPTED.write_text(json.dumps(done, indent=2, sort_keys=True))
    if not JOURNAL.exists():
        JOURNAL.write_text("# Workflow updates adopted into Newsela\n\nWritten by `adopt_updates.py`; rollback: "
                           "`python3 ops/vps-run/adopt_updates.py rollback <id>`.\n\n"
                           "| Release | When (UTC) | Boundary | Pinned file | Basis |\n|---|---|---|---|---|\n")
    with JOURNAL.open("a") as f:
        f.write("\n".join(lines) + "\n")
    return 0


def cmd_rollback(a) -> int:
    done = load(ADOPTED, {})
    rec = done.get(a.id)
    if not rec:
        print(f"no adoption {a.id}", file=sys.stderr)
        return 1
    pin = ROOT / rec["pinned"]
    backup = ROOT / rec["backup"] / pin.name
    if rec.get("existed") and backup.exists():
        shutil.copy2(backup, pin)
    elif not rec.get("existed"):
        pin.unlink(missing_ok=True)
    else:
        print(f"backup missing for {a.id}; restore {rec['pinned']} from git history", file=sys.stderr)
        return 1
    rec["rolled_back"] = now()          # kept, so the same release is not adopted again
    ADOPTED.write_text(json.dumps(done, indent=2, sort_keys=True))
    with JOURNAL.open("a") as f:
        f.write(f"| {a.id} | {now()} | rolled back | `{rec['pinned']}` | restored the pre-adoption copy |\n")
    print(f"ROLLED BACK {a.id}; re-lock with `launcher.py lock --note ...`. A later release of the same file "
          "(new id) is still adopted at the next boundary.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    p = sub.add_parser("apply"); p.add_argument("--boundary", required=True)
    p = sub.add_parser("rollback"); p.add_argument("id")
    a = ap.parse_args()
    return {"status": cmd_status, "apply": cmd_apply, "rollback": cmd_rollback}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
