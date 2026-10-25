#!/usr/bin/env python3
"""Phase B checkpoint (delivery): the remaining zero-to-hero stages are done, verified mechanically.

Passes only when: the FW, §8, UX-5b, §9 and §10 gates are ticked (UX-4 ticked or `n/a — reason`);
the verification, capacity and delivery files exist; the capacity report carries measured values
(`[M]`); every Newsela ticket issue is closed on GitLab; and `main` is clean and pushed to origin.
It cannot judge whether human-only evidence is honest; the prompts and the checklist keep that line.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import finish, gate_ticked, glab_issue_iids, ok_or_na, run, tickets  # noqa: E402

FILES = ["docs/ux/05-verify/TRACEABILITY.md", "docs/ux/05-verify/QA_REPORT.md", "docs/delivery/capacity-report.md",
         "SUBMISSION.md", "docs/delivery/demo-script.md", "docs/delivery/demo-decision-inventory.md",
         "docs/delivery/operating-instructions.md", "docs/testing/error-analysis/README.md"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    root = Path(a.root)
    cfg = json.loads((root / "ops/vps-run/config.json").read_text())
    cl = (root / "PROJECT-CHECKLIST.md").read_text()
    checks = []
    for prefix in ("FW ·", "8 · Build", "UX-5b", "9 · Experiment", "10 · Ship"):
        ok, d = gate_ticked(cl, prefix)
        checks.append((f"gate {prefix}", ok, d))
    ok, d = ok_or_na(cl, "UX-4")
    checks.append(("gate UX-4 (or n/a)", ok, d))
    for f in FILES:
        checks.append((f"exists {f}", (root / f).exists(), "present" if (root / f).exists() else "missing"))
    cap = root / "docs/delivery/capacity-report.md"
    checks.append(("capacity report has measurements", cap.exists() and "[M]" in cap.read_text(),
                   "has [M] values" if cap.exists() and "[M]" in cap.read_text() else "no [M] values"))
    _, opens, gerr = glab_issue_iids(cfg["gitlab_host"], cfg["gitlab_project_id"], root)
    mine = {t.get("gitlab_iid") for t in tickets(root) if t.get("gitlab_iid")}
    still = sorted(i for i in mine if i in opens)
    checks.append(("ticket issues closed", not gerr and not still, gerr or (f"still open: {still}" if still else f"{len(mine)} closed")))
    code, out = run(["git", "status", "--porcelain"], root)
    checks.append(("working tree clean", code == 0 and out == "", "clean" if out == "" else f"{len(out.splitlines())} changes"))
    run(["git", "fetch", "origin", "main"], root, timeout=120)
    _, head = run(["git", "rev-parse", "HEAD"], root)
    _, origin = run(["git", "rev-parse", "origin/main"], root)
    checks.append(("main pushed", head == origin and bool(head), f"HEAD {head[:8]} vs origin/main {origin[:8]}"))
    return finish(checks, Path(a.out), "B")


if __name__ == "__main__":
    sys.exit(main())
