"""Tests for scripts/checklist.py: pack loader, validator, and PRD assembler.

Contract source of truth: references/pack-format.md. These tests import the
functions directly out of scripts/checklist.py via importlib (CHECKLIST_PY) and
also smoke-test the optional CLI (`checklist.py validate <pack>`) via subprocess.

Stdlib only; run with `python3 -m unittest discover -s tests`.
"""
import importlib.util
import os
import re
import sys
import unittest

from helpers import CHECKLIST_PY, SKILL_ROOT, TempDir, run


# Canonical PRD section order, copied verbatim from references/pack-format.md.
# SectionOrderConsistency enforces that "verbatim" rather than trusting it.
SECTION_ORDER = [
    "problem-objective",
    "users-scope",
    "audience-tone-constraints",
    "motion-profile",
    "functional-requirements",
    "non-functional-requirements",
    "system-architecture",
    "tool-integration",
    "verification-correctness",
    "observability-ops",
    "failure-modes-security",
    "testing-strategy",
    "release-iteration",
    "acceptance-criteria",
    "open-questions",
]


# A valid pack: has a functional-requirements question (use-cases) and an
# acceptance-criteria question (criteria); every escalate target exists.
VALID_PACK = """# Checklist: sample-track
- Version: 1.2.3
- Track: sample-track
- Description: A sample pack for tests.

## Phase 1: Constraints

### domain
- Prompt: Which domain? (healthcare / finance / custom)
- Required: true
- Section: problem-objective
- Escalate: verification, use-cases

### use-cases
- Prompt: What specific use cases will you support?
- Required: true
- Section: functional-requirements

## Phase 2: Verification

### verification
- Prompt: How will you verify correctness?
- Required: false
- Default: manual spot-checks
- Section: verification-correctness

### criteria
- Prompt: What acceptance criteria define done?
- Required: true
- Section: acceptance-criteria
"""


# Same data as VALID_PACK but abused whitespace: blank lines between fields,
# spaces around colons, and a missing space after a colon. Must still parse.
MESSY_PACK = """#   Checklist:   messy-track

-  Version :  0.0.1
- Track:messy-track
-   Description:   Messy but still valid.


##  Phase 1:   Only


###   only-q

-   Prompt :   Just one prompt?

-  Required :  true

-  Section :  functional-requirements


###  crit-q
- Prompt: Criteria?
- Required: false
- Section: acceptance-criteria
"""


def parse_pack_format_section_ids():
    """Pull the canonical section-id list out of references/pack-format.md."""
    path = os.path.join(SKILL_ROOT, "references", "pack-format.md")
    with open(path) as f:
        lines = f.read().splitlines()
    starts = [
        i for i, line in enumerate(lines)
        if line.startswith("Questions map into these sections")
    ]
    if len(starts) != 1:
        raise AssertionError(
            "expected exactly one section-id list in pack-format.md, found %d"
            % len(starts)
        )
    chunk = []
    for line in lines[starts[0] + 1:]:
        chunk.append(line)
        if line.rstrip().endswith("."):
            break
    else:
        raise AssertionError("section-id list in pack-format.md is unterminated")
    return re.findall(r"`([a-z0-9-]+)`", " ".join(chunk))


def load_checklist_module():
    """Import scripts/checklist.py fresh. Raises if the file is missing (red)."""
    if not os.path.exists(CHECKLIST_PY):
        raise ImportError("scripts/checklist.py does not exist yet: " + CHECKLIST_PY)
    spec = importlib.util.spec_from_file_location("checklist", CHECKLIST_PY)
    if spec is None or spec.loader is None:
        raise ImportError("could not build import spec for " + CHECKLIST_PY)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ChecklistTestBase(unittest.TestCase):
    def setUp(self):
        # If checklist.py is missing (or errors on import) every test errors out.
        self.checklist = load_checklist_module()

    def load_pack_text(self, text):
        """Write pack text to a temp file and load it through load_pack."""
        with TempDir() as td:
            path = td.write("pack.md", text)
            return self.checklist.load_pack(path)

    def question_by_id(self, pack, qid):
        for phase in pack["phases"]:
            for q in phase["questions"]:
                if q["id"] == qid:
                    return q
        raise AssertionError("question id not found in pack: " + qid)


class LoadPackTests(ChecklistTestBase):
    def test_load_pack_metadata(self):
        pack = self.load_pack_text(VALID_PACK)
        self.assertEqual(pack["version"], "1.2.3")
        self.assertEqual(pack["track"], "sample-track")
        self.assertEqual(pack["description"], "A sample pack for tests.")

    def test_load_pack_phases(self):
        pack = self.load_pack_text(VALID_PACK)
        names = [p["name"] for p in pack["phases"]]
        self.assertEqual(names, ["Constraints", "Verification"])

    def test_load_pack_question_ids_in_order(self):
        pack = self.load_pack_text(VALID_PACK)
        ids = [q["id"] for p in pack["phases"] for q in p["questions"]]
        self.assertEqual(ids, ["domain", "use-cases", "verification", "criteria"])

    def test_load_pack_prompt_text(self):
        pack = self.load_pack_text(VALID_PACK)
        self.assertEqual(
            self.question_by_id(pack, "use-cases")["prompt"],
            "What specific use cases will you support?",
        )

    def test_load_pack_required_is_real_bool(self):
        pack = self.load_pack_text(VALID_PACK)
        required = self.question_by_id(pack, "domain")["required"]
        optional = self.question_by_id(pack, "verification")["required"]
        self.assertIs(required, True)
        self.assertIs(optional, False)

    def test_load_pack_section(self):
        pack = self.load_pack_text(VALID_PACK)
        self.assertEqual(
            self.question_by_id(pack, "use-cases")["section"],
            "functional-requirements",
        )
        self.assertEqual(
            self.question_by_id(pack, "criteria")["section"],
            "acceptance-criteria",
        )

    def test_load_pack_escalate_is_list(self):
        pack = self.load_pack_text(VALID_PACK)
        escalate = self.question_by_id(pack, "domain")["escalate"]
        self.assertIsInstance(escalate, list)
        self.assertEqual(escalate, ["verification", "use-cases"])

    def test_load_pack_escalate_absent_is_empty_list(self):
        pack = self.load_pack_text(VALID_PACK)
        escalate = self.question_by_id(pack, "use-cases")["escalate"]
        self.assertEqual(escalate, [])

    def test_load_pack_default(self):
        pack = self.load_pack_text(VALID_PACK)
        self.assertEqual(
            self.question_by_id(pack, "verification")["default"],
            "manual spot-checks",
        )
        # A question with no Default field must not carry a real default.
        self.assertIn(self.question_by_id(pack, "domain")["default"], (None, ""))

    def test_load_pack_tolerant_of_blank_lines_and_spaced_colons(self):
        pack = self.load_pack_text(MESSY_PACK)
        self.assertEqual(pack["version"], "0.0.1")
        self.assertEqual(pack["track"], "messy-track")
        self.assertEqual([p["name"] for p in pack["phases"]], ["Only"])
        ids = [q["id"] for p in pack["phases"] for q in p["questions"]]
        self.assertEqual(ids, ["only-q", "crit-q"])
        self.assertIs(self.question_by_id(pack, "only-q")["required"], True)
        self.assertEqual(
            self.question_by_id(pack, "only-q")["section"],
            "functional-requirements",
        )


class ValidatePackTests(ChecklistTestBase):
    def test_valid_pack_has_no_errors(self):
        pack = self.load_pack_text(VALID_PACK)
        self.assertEqual(self.checklist.validate_pack(pack), [])

    def test_unknown_section_is_an_error(self):
        pack = self.load_pack_text(VALID_PACK)
        self.question_by_id(pack, "domain")["section"] = "not-a-real-section"
        errors = self.checklist.validate_pack(pack)
        self.assertTrue(errors)
        self.assertTrue(
            any("not-a-real-section" in e for e in errors),
            "expected an error mentioning the bad section id, got: %r" % errors,
        )

    def test_escalate_to_missing_question_is_an_error(self):
        pack = self.load_pack_text(VALID_PACK)
        self.question_by_id(pack, "domain")["escalate"] = ["does-not-exist"]
        errors = self.checklist.validate_pack(pack)
        self.assertTrue(errors)
        self.assertTrue(
            any("does-not-exist" in e for e in errors),
            "expected an error naming the dangling escalate target, got: %r" % errors,
        )

    def test_missing_functional_requirements_question_is_an_error(self):
        pack = self.load_pack_text(VALID_PACK)
        # Move the only functional-requirements question elsewhere.
        self.question_by_id(pack, "use-cases")["section"] = "users-scope"
        errors = self.checklist.validate_pack(pack)
        self.assertTrue(
            any("functional-requirements" in e for e in errors),
            "expected an error about missing functional-requirements, got: %r" % errors,
        )

    def test_missing_acceptance_criteria_question_is_an_error(self):
        pack = self.load_pack_text(VALID_PACK)
        self.question_by_id(pack, "criteria")["section"] = "open-questions"
        errors = self.checklist.validate_pack(pack)
        self.assertTrue(
            any("acceptance-criteria" in e for e in errors),
            "expected an error about missing acceptance-criteria, got: %r" % errors,
        )


class AssemblePrdTests(ChecklistTestBase):
    def _warning_blob(self, prd):
        """All warning-ish text, whether kept in a warnings list or under
        the open-questions section. Lets the assembler pick either home."""
        parts = []
        parts.append(str(prd.get("warnings", "")))
        parts.append(str(prd.get("open_questions", "")))
        sections = prd.get("sections", {})
        if isinstance(sections, dict) and "open-questions" in sections:
            parts.append(str(sections["open-questions"]))
        return " ".join(parts)

    def test_answers_group_under_their_sections(self):
        pack = self.load_pack_text(VALID_PACK)
        answers = {
            "domain": "healthcare",
            "use-cases": "triage inbound patient messages",
            "verification": "human review of a sample",
            "criteria": "95% of triaged messages routed correctly",
        }
        prd = self.checklist.assemble_prd(pack, answers)
        sections = prd["sections"]
        self.assertIn("problem-objective", sections)
        self.assertIn("functional-requirements", sections)
        self.assertIn("acceptance-criteria", sections)
        # The domain answer lives under problem-objective, not elsewhere.
        self.assertIn("healthcare", str(sections["problem-objective"]))
        self.assertNotIn("healthcare", str(sections["functional-requirements"]))
        self.assertIn(
            "triage inbound patient messages",
            str(sections["functional-requirements"]),
        )

    def test_sections_follow_canonical_order(self):
        pack = self.load_pack_text(VALID_PACK)
        # Provide answers in a deliberately scrambled order.
        answers = {
            "criteria": "criterion text",
            "domain": "finance",
            "verification": "eval harness",
            "use-cases": "answer loan questions",
        }
        prd = self.checklist.assemble_prd(pack, answers)
        keys = list(prd["sections"].keys())
        expected = [s for s in SECTION_ORDER if s in keys]
        self.assertEqual(keys, expected)
        # And the four answered sections are exactly what we expect.
        self.assertEqual(
            keys,
            [
                "problem-objective",
                "functional-requirements",
                "verification-correctness",
                "acceptance-criteria",
            ],
        )

    def test_functional_requirement_without_criterion_is_flagged(self):
        pack = self.load_pack_text(VALID_PACK)
        # Answer the functional requirement but give NO acceptance criterion.
        answers = {
            "domain": "healthcare",
            "use-cases": "triage inbound patient messages",
        }
        prd = self.checklist.assemble_prd(pack, answers)
        blob = self._warning_blob(prd)
        self.assertIn(
            "use-cases",
            blob,
            "a functional requirement with no acceptance criterion must be "
            "flagged (in warnings or open-questions); got: %r" % blob,
        )

    def test_functional_requirement_with_criterion_is_not_flagged(self):
        pack = self.load_pack_text(VALID_PACK)
        answers = {
            "domain": "healthcare",
            "use-cases": "triage inbound patient messages",
            "criteria": "95% routed correctly",
        }
        prd = self.checklist.assemble_prd(pack, answers)
        blob = self._warning_blob(prd)
        self.assertNotIn(
            "use-cases",
            blob,
            "no flag expected when an acceptance criterion is present; got: %r" % blob,
        )


class CliSmokeTests(ChecklistTestBase):
    def test_cli_validate_reports_valid_and_invalid(self):
        with TempDir() as td:
            good = td.write("good.md", VALID_PACK)
            # A pack with no acceptance-criteria question -> invalid.
            bad = td.write(
                "bad.md",
                VALID_PACK.replace(
                    "- Section: acceptance-criteria",
                    "- Section: open-questions",
                ),
            )
            ok = run([sys.executable, CHECKLIST_PY, "validate", good])
            self.assertEqual(
                ok.returncode,
                0,
                "validate on a good pack should exit 0; stderr=%r" % ok.stderr,
            )
            fail = run([sys.executable, CHECKLIST_PY, "validate", bad])
            self.assertNotEqual(
                fail.returncode,
                0,
                "validate on an invalid pack should exit non-zero",
            )


class SectionOrderConsistency(ChecklistTestBase):
    """The section order exists in three places; they must not drift apart.

    The ordering test elsewhere in this file only checks the relative order of
    ids a fixture happens to exercise, so a section added to one copy and not
    the others stays green there. This is the check that actually catches it.
    """

    def test_three_section_order_copies_agree(self):
        from_docs = parse_pack_format_section_ids()
        self.assertEqual(self.checklist.SECTION_ORDER, from_docs)
        self.assertEqual(SECTION_ORDER, from_docs)

    def test_every_shipped_pack_uses_known_sections(self):
        known = set(parse_pack_format_section_ids())
        packs_dir = os.path.join(SKILL_ROOT, "checklists")
        names = sorted(n for n in os.listdir(packs_dir) if n.endswith(".md"))
        self.assertTrue(names, "no checklist packs found to check")
        seen = 0
        for name in names:
            pack = self.checklist.load_pack(os.path.join(packs_dir, name))
            for phase in pack["phases"]:
                for question in phase["questions"]:
                    seen += 1
                    self.assertIn(
                        question["section"],
                        known,
                        "%s: question %r targets unknown section %r"
                        % (name, question["id"], question["section"]),
                    )
        self.assertGreater(seen, 0, "packs parsed but no questions were checked")


if __name__ == "__main__":
    unittest.main()
