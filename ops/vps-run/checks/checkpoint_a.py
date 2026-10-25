#!/usr/bin/env python3
"""Phase A checkpoint (Opus → Sonnet transition): complete ticketing, verified mechanically.

Passes only when: the design and ticketing gates are ticked; the Stage 6 mechanical checks pass
(design outputs, signature completeness, context shape); every planned ticket of every wave has a
JSON record and a spec with the required parts, passes `ticket_readiness.py`, and is published as a
GitLab issue; the slice plan covers frontend, backend, integration, verification, experiments and
delivery with its parallelism audit and collision map; the coverage audit passes; and the Sonnet
handoff file exists with every required section. Publication blocked → this fails and says so.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import (HOME, finish, gate_ticked, glab_issue_iids, register_path, run,  # noqa: E402
                    tickets)

SPEC_PARTS = ["story", "acceptance", "lane", "depends on", "sources"]
HANDOFF_PARTS = ["accepted designs", "decisions", "contracts", "ticket register", "execution order", "budgets",
                 "test instructions", "known risks", "next action"]
SLICE_WORDS = {"frontend": r"frontend", "backend": r"backend", "integration": r"integration",
               "verification (UX-5a/5b)": r"UX-5|verification", "experiments (§9)": r"experiment",
               "delivery (§10)": r"delivery|§10|ship", "parallelism audit": r"parallelism audit",
               "collision map": r"collision map"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    root = Path(a.root)
    cfg = json.loads((root / "ops/vps-run/config.json").read_text())
    checks = []
    cl = (root / "PROJECT-CHECKLIST.md").read_text()
    for prefix in ("4b · UX-1", "UX-2", "UX-3a", "UX-3b", "5 · Spikes", "6 · Design", "7 · Tickets"):
        ok, d = gate_ticked(cl, prefix)
        checks.append((f"gate {prefix}", ok, d))

    iv = (root / "docs/prd/interview.md").read_text()
    sdr = root / ".claude/workflow/system-design-readiness/scripts"
    code, out = run([sys.executable, str(sdr / "design_outputs.py"), "check", "docs/prd/interview.md",
                     "--gate", "tickets", "--root", "."], root)
    checks.append(("design_outputs.py --gate tickets", code == 0, out.splitlines()[-1] if out else f"exit {code}"))
    paths = {k: register_path(iv, k) for k in ("DO-3", "DO-4", "DO-6")}
    if all(paths.values()):
        code, out = run([sys.executable, str(sdr / "signature_check.py"), "--code-design", paths["DO-3"],
                         "--contracts", paths["DO-4"], "--observability", paths["DO-6"],
                         "--openapi", "docs/contracts/interface.openapi.yaml"], root)
        checks.append(("signature_check.py", code == 0, out.splitlines()[-1] if out else f"exit {code}"))
    else:
        checks.append(("signature_check.py", False, f"DO-3/DO-4/DO-6 paths not in the register: {paths}"))
    code, out = run([sys.executable, str(HOME / ".claude/skills/icm-project/scripts/check_context.py"), "."], root)
    checks.append(("check_context.py", code == 0 and "FAIL" not in out, out.splitlines()[-1] if out else f"exit {code}"))
    for f in ("docs/design/spec-dry-run.md", "docs/design/system-design.md", "docs/design/architecture.md",
              "docs/design/code-design.md", "docs/design/component-contracts.md", "docs/design/eval-plan.md",
              "docs/design/observability.md", "docs/design/metrics-registry.md", ".claude/reference/area-map.md"):
        checks.append((f"exists {f}", (root / f).exists(), "present" if (root / f).exists() else "missing"))

    sp = root / "docs/plans/slice-plan.md"
    text = sp.read_text() if sp.exists() else ""
    for label, pat in SLICE_WORDS.items():
        checks.append((f"slice plan covers {label}", bool(re.search(pat, text, re.I)), "found" if re.search(pat, text, re.I) else "not found"))

    ts = tickets(root)
    checks.append(("ticket register", len(ts) > 0, f"{len(ts)} tickets in docs/plans/tickets/"))
    rd = root / ".claude/skills/zero-to-hero/scripts/ticket_readiness.py"
    iids_all, _, gerr = glab_issue_iids(cfg["gitlab_host"], cfg["gitlab_project_id"], root)
    if gerr:
        checks.append(("GitLab issue list", False, f"publication cannot be verified: {gerr}"))
    for t in ts:
        tid = t.get("id", t["_path"].stem)
        spec = t["_path"].with_suffix(".md")
        stext = spec.read_text().lower() if spec.exists() else ""
        missing = [p for p in SPEC_PARTS if p not in stext]
        checks.append((f"{tid} spec", spec.exists() and not missing,
                       "complete" if spec.exists() and not missing else f"missing {missing or 'spec file'}"))
        for field in ("wave", "lane"):
            checks.append((f"{tid} {field}", bool(t.get(field)), str(t.get(field) or "not set")))
        code, out = run([sys.executable, str(rd), "check", str(t["_path"]), "--root", "."], root)
        checks.append((f"{tid} readiness", code == 0, out.splitlines()[0] if out else f"exit {code}"))
        iid = t.get("gitlab_iid")
        checks.append((f"{tid} published", bool(iid) and iid in iids_all,
                       f"issue #{iid}" if iid in iids_all else f"no GitLab issue recorded/found (gitlab_iid={iid})"))

    code, out = run([sys.executable, str(root / ".claude/workflow/to-tickets/scripts/coverage_audit.py"), "check",
                     "docs/plans/coverage-audit.md", "--tickets", "docs/plans/tickets.md",
                     "--workflows", "docs/design/observability.md", "--stage", "publish"], root)
    checks.append(("coverage_audit.py --stage publish", code == 0, out.splitlines()[-1] if out else f"exit {code}"))

    ho = root / "docs/plans/HANDOFF-PHASE-B.md"
    htext = ho.read_text().lower() if ho.exists() else ""
    hmiss = [p for p in HANDOFF_PARTS if p not in htext]
    checks.append(("Sonnet handoff", ho.exists() and not hmiss, "complete" if ho.exists() and not hmiss else f"missing {hmiss or 'file'}"))
    return finish(checks, Path(a.out), "A")


if __name__ == "__main__":
    sys.exit(main())
