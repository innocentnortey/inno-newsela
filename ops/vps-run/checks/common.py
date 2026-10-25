"""Shared helpers for the Newsela launcher checkpoints (standard library only).

Each check returns (name, ok, detail). A checkpoint passes only when every check passes; the
result is written as JSON so the launcher can hand the failing list to the next run.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

HOME = Path.home()


def run(cmd: list[str], cwd: Path, timeout: int = 900) -> tuple[int, str]:
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout + r.stderr).strip()
    except Exception as e:  # noqa: BLE001
        return 99, f"could not run {cmd[0]}: {e}"


def sections(checklist: str) -> dict[str, str]:
    """`## ` heading → body."""
    out, cur, buf = {}, None, []
    for line in checklist.split("\n"):
        if line.startswith("## "):
            if cur:
                out[cur] = "\n".join(buf)
            cur, buf = line[3:].strip(), []
        else:
            buf.append(line)
    if cur:
        out[cur] = "\n".join(buf)
    return out


def gate_ticked(checklist: str, heading_prefix: str) -> tuple[bool, str]:
    for h, body in sections(checklist).items():
        if h.startswith(heading_prefix):
            gates = [l for l in body.split("\n") if l.lstrip().startswith("- **Gate:**")]
            if not gates:
                return False, f"'{h}' has no gate line"
            ok = all("☑" in g or "[x]" in g for g in gates)
            return ok, ("ticked" if ok else f"'{h}' gate not ticked")
    return False, f"no checklist section starting '{heading_prefix}'"


def ok_or_na(checklist: str, heading_prefix: str) -> tuple[bool, str]:
    """Gate ticked, or the section records `n/a — <reason>` on its gate line."""
    for h, body in sections(checklist).items():
        if h.startswith(heading_prefix):
            g = [l for l in body.split("\n") if l.lstrip().startswith("- **Gate:**")]
            if g and ("☑" in g[0] or re.search(r"n/a\s*—\s*\S", g[0])):
                return True, "ticked or n/a recorded"
            return False, f"'{h}' gate neither ticked nor n/a with a reason"
    return False, f"no checklist section starting '{heading_prefix}'"


def register_path(interview: str, do_id: str) -> str | None:
    m = re.search(rf"^\| {do_id} \|[^|]*\|[^|]*\| *([^| ]+)", interview, flags=re.M)
    return m.group(1).strip("`") if m else None


def tickets(root: Path) -> list[dict]:
    out = []
    for p in sorted((root / "docs/plans/tickets").glob("*.json")):
        if p.name.startswith("probe"):
            continue
        d = json.loads(p.read_text())
        d["_path"] = p
        out.append(d)
    return out


def glab_issue_iids(host: str, project_id: int, cwd: Path) -> tuple[set[int], set[int], str]:
    """(all iids, open iids, error)."""
    alls, opens, page = set(), set(), 1
    while True:
        code, out = run(["glab", "api", f"projects/{project_id}/issues?per_page=100&page={page}&state=all",
                         "--hostname", host], cwd, timeout=120)
        if code != 0:
            return alls, opens, out[:200]
        try:
            batch = json.loads(out)
        except json.JSONDecodeError:
            return alls, opens, "could not parse the GitLab issue list"
        if not batch:
            return alls, opens, ""
        for i in batch:
            alls.add(i["iid"])
            if i["state"] == "opened":
                opens.add(i["iid"])
        page += 1


def finish(checks: list[tuple[str, bool, str]], out: Path, phase: str) -> int:
    failed = [f"{n}: {d}" for n, ok, d in checks if not ok]
    data = {"phase": phase, "passed": not failed, "checks": [{"name": n, "ok": ok, "detail": d} for n, ok, d in checks],
            "failed": failed}
    out.write_text(json.dumps(data, indent=2))
    for n, ok, d in checks:
        print(f"{'PASS' if ok else 'FAIL'}  {n} — {d}")
    print(f"checkpoint {phase}: {'PASS' if not failed else f'FAIL ({len(failed)} failing)'}")
    return 0 if not failed else 1
