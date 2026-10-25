"""Tests for scripts/ticket_readiness.py — the representative cases of
proposals/2026-10-25-concurrent-frontend.md §6, plus error handling.

Each test builds a tiny fake project repo in tmp_path and runs the CLI against a ticket JSON from
tests/fixtures/tickets/ (or one written inline).
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
SCRIPT = HERE.parent / "scripts" / "ticket_readiness.py"
TICKETS = HERE / "fixtures" / "tickets"

sys.path.insert(0, str(SCRIPT.parent))
import ticket_readiness as tr  # noqa: E402


def checklist(s6: bool, ux2: bool) -> str:
    tick = lambda on: "☑" if on else "☐"  # noqa: E731
    return f"""# Project checklist

## 4b · UX-1 (fork)
- **Gate:** ☑ flows reviewed (Claude-closed)

## UX-2 · Visual direction ★ — UX track
- [ ] look sheets
- **Gate:** {tick(ux2)} Innocent picks a direction

## UX-3a · Shared contracts ★ — Joint track
- **Gate:** ☐ every CON agreed before use

## 5 · Spikes — System track
- **Gate:** ☑ spikes closed

## 6 · Design — System track
- DO-3 code design
- **Gate:** {tick(s6)} Innocent approves the Stage 6 page

## 7 · Tickets ★
- **Gate:** ☐ four passes
"""


INTERFACE = """# Interface

## CON-3 · Validation report
**Status:** agreed (UX: session A 2026-10-25; System: session B 2026-10-25)

## CON-4 · Report export
- **Status:** Agreed

## CON-18 · Approval review
**Status:** proposed — waiting on UXP-4 "who may reopen"
"""

SCREENS = """# Screen specs

## SCR-4 · Validation report
**Status:** signed (Innocent, 2026-10-25)

## SCR-14 · Approval review
**Status:** signed
"""

FOUNDATION = """# Foundation wave readiness record
## Stack
Next.js + React (decision D-3)
## Owned files
src/ui/**
## Scope
tokens, typography, basic components
## Dependencies
none
## Ticket specs
### FW-1
## Review requirements
code review, axe, visual check
"""

DESIGN_MD = "# design.md\n\n## Design tokens\n--color-ink: #111;\n"


def make_repo(root: Path, *, s6=False, ux2=True, interface=INTERFACE, screens=SCREENS,
              foundation=FOUNDATION, design=DESIGN_MD, merged=None, picked_line=False):
    files = {
        "PROJECT-CHECKLIST.md": checklist(s6, ux2),
        "docs/contracts/INTERFACE.md": interface,
        "docs/ux/03-structure/SCREEN_SPECS.md": screens,
        "docs/plans/foundation-wave.md": foundation,
        "docs/design/design.md": design,
        "docs/plans/merged.txt": merged,
        "docs/design/DESIGN-DIRECTIONS.md": "**Picked:** Direction B (Innocent)\n" if picked_line else None,
    }
    for rel, text in files.items():
        if text is not None:
            p = root / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text, encoding="utf-8")
    return root


def run(ticket: Path, root: Path, *extra):
    proc = subprocess.run([sys.executable, str(SCRIPT), "check", str(ticket), "--root", str(root), *extra],
                          capture_output=True, text=True)
    return proc.returncode, proc.stdout + proc.stderr


def write_ticket(tmp_path: Path, data: dict) -> Path:
    p = tmp_path / "ticket.json"
    p.write_text(json.dumps(data), encoding="utf-8")
    return p


# ---------- §6 case 1: allowed early foundation ticket ----------

def test_foundation_ready_before_s6(tmp_path):
    repo = make_repo(tmp_path / "repo", s6=False, ux2=True)
    code, out = run(TICKETS / "fw1-tokens.json", repo)
    assert code == 0, out
    assert out.startswith("READY FW-1")


def test_foundation_pick_via_design_directions(tmp_path):
    repo = make_repo(tmp_path / "repo", ux2=False, picked_line=True)
    assert run(TICKETS / "fw1-tokens.json", repo)[0] == 0


def test_foundation_needs_pick_tokens_and_record(tmp_path):
    repo = make_repo(tmp_path / "repo", ux2=False, design="# design.md\n## Colours\n",
                     foundation="# FW\n## Stack\n## Scope\n")
    code, out = run(TICKETS / "fw1-tokens.json", repo)
    assert code == 1
    assert "UX-2" in out and "tokens" in out
    assert "Owned files" in out and "Review requirements" in out


# ---------- §6 case 2: frontend blocked by a proposed CON ----------

def test_frontend_blocked_by_proposed_con(tmp_path):
    repo = make_repo(tmp_path / "repo", s6=True)
    code, out = run(TICKETS / "fe-scr14.json", repo)
    assert code == 1
    assert "NOT READY" in out
    assert "CON-18" in out and "proposed" in out


# ---------- §6 case 3: ready frontend ticket with no prototype ----------

def test_frontend_ready_without_ux4_ux5(tmp_path):
    repo = make_repo(tmp_path / "repo", s6=True)
    text = (repo / "PROJECT-CHECKLIST.md").read_text()
    assert "UX-4" not in text and "UX-5" not in text
    code, out = run(TICKETS / "fe-scr4.json", repo)
    assert code == 0, out
    assert out.startswith("READY T-7")


def test_frontend_needs_screens(tmp_path):
    repo = make_repo(tmp_path / "repo", s6=True)
    code, out = run(write_ticket(tmp_path, {"id": "T-8", "kind": "frontend", "cons": ["CON-3"]}), repo)
    assert code == 1 and "screens" in out


def test_frontend_unsigned_screen(tmp_path):
    repo = make_repo(tmp_path / "repo", s6=True,
                     screens="## SCR-4 · Validation report\n**Status:** draft\n")
    code, out = run(TICKETS / "fe-scr4.json", repo)
    assert code == 1 and "SCR-4" in out and "draft" in out


# ---------- §6 case 4: foundation reaching into behaviour ----------

def test_foundation_autosave_rejected(tmp_path):
    repo = make_repo(tmp_path / "repo")
    code, out = run(TICKETS / "fw2-autosave.json", repo)
    assert code == 1
    assert "autosave" in out and "foundation scope" in out


@pytest.mark.parametrize("scope", ["permission checks", "resume a draft", "booking widget", "job state badge",
                                   "data fetching hook", "backend error banner", "error recovery",
                                   "real-time cursors", "collaboration presence", "auth gate"])
def test_foundation_scope_guard_words(scope):
    unmet = []
    tr.need_foundation_scope([scope], unmet)
    assert unmet, scope


@pytest.mark.parametrize("scope", ["design tokens", "typography", "button", "status pill", "authoring guide",
                                   "dialog shell", "split panes"])
def test_foundation_scope_guard_allows_presentation(scope):
    unmet = []
    tr.need_foundation_scope([scope], unmet)
    assert not unmet, unmet


# ---------- §6 case 5: backend before §6 ----------

def test_backend_before_s6(tmp_path):
    repo = make_repo(tmp_path / "repo", s6=False)
    code, out = run(TICKETS / "be-con3.json", repo)
    assert code == 1 and "§6" in out


def test_backend_ready_after_s6(tmp_path):
    repo = make_repo(tmp_path / "repo", s6=True)
    assert run(TICKETS / "be-con3.json", repo)[0] == 0


def test_backend_needs_cons(tmp_path):
    repo = make_repo(tmp_path / "repo", s6=True)
    code, out = run(write_ticket(tmp_path, {"id": "T-13", "kind": "backend"}), repo)
    assert code == 1 and "CON-N" in out


# ---------- §6 case 6: integration plan vs execute ----------

def test_integration_plannable_any_time(tmp_path):
    repo = make_repo(tmp_path / "repo", s6=False)
    code, out = run(TICKETS / "int-scr4.json", repo)
    assert code == 0, out


def test_integration_plan_needs_dependencies(tmp_path):
    repo = make_repo(tmp_path / "repo")
    code, out = run(write_ticket(tmp_path, {"id": "T-31", "kind": "integration", "phase": "plan"}), repo)
    assert code == 1 and "frontend" in out and "backend" in out


def test_integration_execute_waits_for_merges(tmp_path):
    repo = make_repo(tmp_path / "repo", merged="T-7\n")
    data = json.loads((TICKETS / "int-scr4.json").read_text())
    data["phase"] = "execute"
    code, out = run(write_ticket(tmp_path, data), repo)
    assert code == 1 and "T-12" in out and "T-7," not in out


def test_integration_execute_ready_when_merged(tmp_path):
    repo = make_repo(tmp_path / "repo", merged="# merged tickets\nT-7, T-12\n")
    data = json.loads((TICKETS / "int-scr4.json").read_text())
    data["phase"] = "execute"
    code, out = run(write_ticket(tmp_path, data), repo)
    assert code == 0, out


def test_integration_execute_without_merged_file(tmp_path):
    repo = make_repo(tmp_path / "repo")
    data = dict(json.loads((TICKETS / "int-scr4.json").read_text()), phase="execute")
    code, out = run(write_ticket(tmp_path, data), repo)
    assert code == 1 and "merged.txt" in out


# ---------- errors and output ----------

def test_missing_interface_is_clear(tmp_path):
    repo = make_repo(tmp_path / "repo", s6=True, interface=None)
    code, out = run(TICKETS / "be-con3.json", repo)
    assert code == 1
    assert "docs/contracts/INTERFACE.md not found" in out and "CON-3" in out


def test_unknown_kind_exits_2(tmp_path):
    repo = make_repo(tmp_path / "repo")
    code, out = run(write_ticket(tmp_path, {"id": "X-1", "kind": "docs"}), repo)
    assert code == 2 and "unknown kind" in out


def test_bad_json_exits_2(tmp_path):
    p = tmp_path / "bad.json"
    p.write_text("{not json")
    assert run(p, make_repo(tmp_path / "repo"))[0] == 2


def test_json_output(tmp_path):
    repo = make_repo(tmp_path / "repo", s6=True)
    code, out = run(TICKETS / "fe-scr14.json", repo, "--json")
    data = json.loads(out)
    assert code == 1 and data["ready"] is False and data["id"] == "T-21"
    assert any("CON-18" in u for u in data["unmet"])
