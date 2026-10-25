"""Tests for scripts/bridge.py: the prd-interview -> tdd-swarm handoff bridge.

`bridge.py` turns the manual `handoffs.py register` step documented in SKILL.md
into a real, tested tool. It validates an approved PRD, then shells out to
tdd-swarm's `scripts/handoffs.py register` to append a `spec:<name>` handoff
(status delivered) to the TARGET project's HANDOFFS.md.

CONTRACT (implementer must match EXACTLY)
-----------------------------------------
CLI:
    bridge.py register-prd \\
        --prd  <path-to-PRD.md> \\
        --repo <target tdd-swarm project dir> \\
        --id   H<n> \\
        --from product/<product-epic> \\
        --to   coding/<coding-epic> \\
        --name <artifact-name>

Behavior:
  * Locates tdd-swarm's handoffs.py at `<TDD_SWARM_DIR>/scripts/handoffs.py`,
    where TDD_SWARM_DIR comes from the environment variable of that name, or
    defaults to the sibling skill dir `../tdd-swarm` when the env var is unset. If that
    handoffs.py does not exist -> clear non-zero error, nothing registered.
  * Validates the PRD: the --prd file must EXIST and be NON-EMPTY and contain an
    acceptance-criteria marker -- defined as the case-insensitive substring
    "acceptance". A missing, empty, or too-thin PRD -> non-zero error and the
    target HANDOFFS.md is left byte-for-byte unchanged.
  * On a valid PRD it builds the artifact string `spec:<name>-><prd path>` and
    invokes handoffs.py:
        handoffs.py register <id> --from <from> --to <to> \\
            --artifact "spec:<name>-><prd path>" --status delivered --repo <repo>
    so the target HANDOFFS.md gains a section with the handoff <id>, the
    `spec:<name>` artifact, and Status: delivered. Duplicate ids are handled per
    handoffs.py's own behavior (it refuses a duplicate id, non-zero).

Exit codes:
    0  success (handoff registered)
    non-zero  PRD invalid (missing / empty / no acceptance marker) -- nothing
              registered; ledger unchanged
    non-zero  handoffs.py not found under TDD_SWARM_DIR
    non-zero  handoffs.py itself refused the register (e.g. duplicate id)

Stdlib only; run with `python3 -m unittest discover -s tests`.
"""
import importlib.util
import os
import sys
import unittest

from helpers import SCRIPTS_DIR, TempDir, run


BRIDGE_PY = os.path.join(SCRIPTS_DIR, "bridge.py")

# The REAL tdd-swarm skill on this machine; its handoffs.py is the register CLI
# the bridge shells out to. The default TDD_SWARM_DIR resolves here too.
# Project scope: tdd-swarm is a sibling skill directory (<repo>/.claude/skills/tdd-swarm),
# overridable with TDD_SWARM_DIR. Tests skip when it is absent (e.g. in a working copy).
REAL_TDD_SWARM_DIR = os.path.normpath(os.path.expanduser(
    os.environ.get("TDD_SWARM_DIR")
    or os.path.join(os.path.dirname(SCRIPTS_DIR), os.pardir, "tdd-swarm")
))
REAL_HANDOFFS_PY = os.path.join(REAL_TDD_SWARM_DIR, "scripts", "handoffs.py")


# A realistic approved PRD: carries an explicit Acceptance Criteria section with
# testable requirements. This is what the bridge must accept.
VALID_PRD = """# PRD: Onboarding Flow

## Problem & Objective
New users drop off before finishing setup.

## Functional Requirements
- The system must send a welcome email within 60 seconds of signup.
- The onboarding wizard shall have exactly 3 steps.

## Acceptance Criteria
- Given a new signup, when 60s elapse, a welcome email is delivered (checked in logs).
- 95% of users reach step 3 within a single session.
"""

# A too-thin doc: prose only, no acceptance-criteria marker anywhere. The bridge
# must reject this so a shallow "spec" never gets handed to Coding.
THIN_PRD = """# Onboarding idea

We want onboarding to feel nicer and simpler. Maybe add a couple of emails
and a shorter wizard at some point.
"""


def make_target_repo(td):
    """Build a minimal tdd-swarm-shaped TARGET project inside TempDir `td`.

    Returns (repo_path, handoffs_md_path). The ledger starts as a known,
    non-empty baseline so "left unchanged" assertions can compare exact bytes.
    """
    td.write("EPICS.md", "# Epics\n\n## CODE-E1: Build the thing\n- Team: coding\n")
    handoffs_md = td.write("HANDOFFS.md", "# Handoffs\n")
    return td.path, handoffs_md


def bridge_env(tdd_swarm_dir=REAL_TDD_SWARM_DIR):
    return {"TDD_SWARM_DIR": tdd_swarm_dir}


class BridgeSmokeTests(unittest.TestCase):
    """A genuinely-green smoke test: the dependency the bridge shells out to
    (tdd-swarm's handoffs.py) is present and importable with a `register` CLI.
    This does NOT touch bridge.py, so it passes today and pins the contract the
    bridge is built against."""

    def test_real_handoffs_module_has_register(self):
        # Working copies (e.g. inno-agentforce) deliberately carry no tdd-swarm;
        # only the Gauntlet AI original has it as a sibling skill.
        if not os.path.exists(REAL_HANDOFFS_PY):
            self.skipTest("tdd-swarm not present beside this skill (%r)" % REAL_HANDOFFS_PY)
        spec = importlib.util.spec_from_file_location("handoffs", REAL_HANDOFFS_PY)
        self.assertIsNotNone(spec)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertTrue(
            callable(getattr(module, "register", None)),
            "handoffs.py must expose a register() the bridge can rely on",
        )


class BridgeRegisterPrdTests(unittest.TestCase):
    def setUp(self):
        # Every behavior test is RED until scripts/bridge.py exists, and REAL
        # thereafter (mirrors ChecklistTestBase requiring checklist.py).
        self.assertTrue(
            os.path.exists(BRIDGE_PY),
            "scripts/bridge.py does not exist yet: " + BRIDGE_PY,
        )
        if not os.path.exists(REAL_HANDOFFS_PY):
            self.skipTest("real tdd-swarm handoffs.py not available on this machine")

    def _register(self, prd_path, repo, name="onboarding", hid="H7", env=None):
        return run(
            [
                sys.executable, BRIDGE_PY, "register-prd",
                "--prd", prd_path,
                "--repo", repo,
                "--id", hid,
                "--from", "product/PROD-E1",
                "--to", "coding/CODE-E1",
                "--name", name,
            ],
            env=env if env is not None else bridge_env(),
        )

    def test_valid_prd_registers_delivered_handoff(self):
        with TempDir() as td:
            repo, handoffs_md = make_target_repo(td)
            prd = td.write("prd.md", VALID_PRD)
            result = self._register(prd, repo, name="onboarding", hid="H7")
            self.assertEqual(
                result.returncode, 0,
                "register-prd on a valid PRD should exit 0; stderr=%r" % result.stderr,
            )
            with open(handoffs_md) as f:
                ledger = f.read()
            self.assertIn("H7", ledger)
            self.assertIn("spec:onboarding", ledger)
            self.assertIn("delivered", ledger)

    def test_artifact_string_embeds_name_and_prd_path(self):
        with TempDir() as td:
            repo, handoffs_md = make_target_repo(td)
            prd = td.write("prd.md", VALID_PRD)
            result = self._register(prd, repo, name="checkout", hid="H3")
            self.assertEqual(
                result.returncode, 0,
                "expected exit 0; stderr=%r" % result.stderr,
            )
            with open(handoffs_md) as f:
                ledger = f.read()
            # Artifact string format is `spec:<name>-><prd path>`.
            self.assertIn("spec:checkout->", ledger)
            self.assertIn(prd, ledger)

    def test_missing_prd_file_errors_and_leaves_ledger_unchanged(self):
        with TempDir() as td:
            repo, handoffs_md = make_target_repo(td)
            with open(handoffs_md) as f:
                before = f.read()
            missing = os.path.join(td.path, "nope.md")  # never created
            result = self._register(missing, repo)
            self.assertNotEqual(
                result.returncode, 0,
                "a missing PRD file must be a non-zero error",
            )
            with open(handoffs_md) as f:
                after = f.read()
            self.assertEqual(
                after, before,
                "the target ledger must be untouched when the PRD is missing",
            )

    def test_empty_prd_file_is_rejected(self):
        with TempDir() as td:
            repo, handoffs_md = make_target_repo(td)
            with open(handoffs_md) as f:
                before = f.read()
            empty = td.write("empty.md", "")
            result = self._register(empty, repo)
            self.assertNotEqual(
                result.returncode, 0,
                "an empty PRD must be rejected non-zero",
            )
            with open(handoffs_md) as f:
                after = f.read()
            self.assertEqual(after, before, "ledger must be untouched on empty PRD")

    def test_thin_prd_without_acceptance_markers_is_rejected(self):
        with TempDir() as td:
            repo, handoffs_md = make_target_repo(td)
            with open(handoffs_md) as f:
                before = f.read()
            thin = td.write("thin.md", THIN_PRD)
            result = self._register(thin, repo)
            self.assertNotEqual(
                result.returncode, 0,
                "a PRD with no acceptance-criteria marker must be rejected",
            )
            with open(handoffs_md) as f:
                after = f.read()
            self.assertEqual(
                after, before,
                "nothing may be registered from a too-thin PRD",
            )

    def test_handoffs_py_not_found_is_a_clear_error(self):
        with TempDir() as td:
            repo, handoffs_md = make_target_repo(td)
            with open(handoffs_md) as f:
                before = f.read()
            prd = td.write("prd.md", VALID_PRD)  # a VALID prd -- fault is the dir
            nowhere = os.path.join(td.path, "no-such-tdd-swarm")
            result = self._register(prd, repo, env=bridge_env(nowhere))
            self.assertNotEqual(
                result.returncode, 0,
                "a bad TDD_SWARM_DIR (no handoffs.py) must fail non-zero",
            )
            with open(handoffs_md) as f:
                after = f.read()
            self.assertEqual(
                after, before,
                "ledger must be untouched when handoffs.py cannot be found",
            )


if __name__ == "__main__":
    unittest.main()
