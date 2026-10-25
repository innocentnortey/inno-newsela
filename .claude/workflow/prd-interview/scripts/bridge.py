"""prd-interview -> tdd-swarm handoff bridge.  LEGACY: not part of the current workflow.

The tdd-swarm engine and its HANDOFFS.md ledger were retired from the Gauntlet
workflow on 2026-09-19; approved PRDs now go to GitLab issues via `to-tickets`.
This helper is kept only for old copies and its existing tests. See README.md.

Turns the manual `handoffs.py register` step documented in SKILL.md into a
real, tested tool. It validates an approved PRD, then shells out to tdd-swarm's
`scripts/handoffs.py register` to append a `spec:<name>` handoff (status
delivered) to the TARGET project's HANDOFFS.md.

Stdlib only. The CLI (`bridge.py register-prd ...`) is guarded behind __main__
so importing this module has no side effects.

CLI:
    bridge.py register-prd \\
        --prd  <path-to-PRD.md> \\
        --repo <target tdd-swarm project dir> \\
        --id   H<n> \\
        --from product/<product-epic> \\
        --to   coding/<coding-epic> \\
        --name <artifact-name>

Exit codes:
    0         handoff registered
    non-zero  PRD invalid (missing / empty / no "acceptance" marker) -- nothing
              registered; ledger unchanged
    non-zero  handoffs.py not found under TDD_SWARM_DIR
    non-zero  handoffs.py itself refused the register (propagated)
"""
import argparse
import os
import subprocess
import sys


# Sibling skill directory (project scope: <repo>/.claude/skills/tdd-swarm). Override with TDD_SWARM_DIR.
DEFAULT_TDD_SWARM_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), os.pardir, "tdd-swarm"
)


def tdd_swarm_dir():
    """Resolve the tdd-swarm skill directory (env var or the sibling-skill default), expanded."""
    return os.path.normpath(os.path.expanduser(os.environ.get("TDD_SWARM_DIR") or DEFAULT_TDD_SWARM_DIR))


def handoffs_py_path():
    """Absolute path to tdd-swarm's handoffs.py register CLI."""
    return os.path.join(tdd_swarm_dir(), "scripts", "handoffs.py")


def validate_prd(prd_path):
    """Return None if the PRD is acceptable, else an error string.

    A valid PRD must EXIST, be NON-EMPTY, and contain the case-insensitive
    substring "acceptance" (the acceptance-criteria marker).
    """
    if not os.path.isfile(prd_path):
        return "PRD file does not exist: %s" % prd_path
    with open(prd_path, encoding="utf-8", errors="replace") as f:
        text = f.read()
    if text.strip() == "":
        return "PRD file is empty: %s" % prd_path
    if "acceptance" not in text.lower():
        return (
            "PRD has no acceptance-criteria marker (case-insensitive "
            "'acceptance'): %s" % prd_path
        )
    return None


def register_prd(prd, repo, hid, frm, to, name):
    """Validate `prd` and register a delivered spec handoff via handoffs.py.

    Returns an exit code: 0 on success, non-zero on any failure (nothing
    registered, target ledger untouched on validation / discovery failures).
    """
    # Validate BEFORE touching handoffs.py so the ledger stays byte-for-byte
    # unchanged on any invalid PRD.
    err = validate_prd(prd)
    if err is not None:
        sys.stderr.write("bridge.py: " + err + "\n")
        return 1

    handoffs_py = handoffs_py_path()
    if not os.path.isfile(handoffs_py):
        sys.stderr.write(
            "bridge.py: tdd-swarm handoffs.py not found at %s "
            "(set TDD_SWARM_DIR to the tdd-swarm skill directory)\n" % handoffs_py
        )
        return 1

    artifact = "spec:%s->%s" % (name, prd)
    cmd = [
        sys.executable, handoffs_py, "register", hid,
        "--from", frm,
        "--to", to,
        "--artifact", artifact,
        "--status", "delivered",
        "--repo", repo,
    ]
    # Propagate handoffs.py's exit code (a refusal -- e.g. duplicate id -- is
    # non-zero). Its own stdout/stderr surface the reason.
    result = subprocess.run(cmd)
    return result.returncode


def _cli(argv):
    parser = argparse.ArgumentParser(
        prog="bridge.py",
        description="Register an approved PRD as a tdd-swarm spec handoff.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_reg = sub.add_parser(
        "register-prd",
        help="validate a PRD and register it as a delivered spec handoff",
    )
    p_reg.add_argument("--prd", required=True, help="path to the approved PRD.md")
    p_reg.add_argument("--repo", required=True, help="target tdd-swarm project dir")
    p_reg.add_argument("--id", dest="id", required=True, help="handoff id, e.g. H7")
    p_reg.add_argument(
        "--from", dest="frm", required=True, help="product/<product-epic>")
    p_reg.add_argument("--to", required=True, help="coding/<coding-epic>")
    p_reg.add_argument("--name", required=True, help="artifact name")

    args = parser.parse_args(argv)
    if args.command == "register-prd":
        return register_prd(
            args.prd, args.repo, args.id, args.frm, args.to, args.name)
    parser.error("unknown command")
    return 2


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
