"""Tests for scripts/interview.py: coverage skeleton and interview-document checks.

Stdlib only; run with `python3 -m unittest discover -s tests`.
"""
import importlib.util
import os
import sys
import unittest

from helpers import SCRIPTS_DIR, SKILL_ROOT, TempDir, run

INTERVIEW_PY = os.path.join(SCRIPTS_DIR, "interview.py")
REAL_CHECKLIST = os.path.normpath(os.path.join(
    SKILL_ROOT, os.pardir, "system-design-readiness", "CHECKLIST.md"))

CHECKLIST = """# Checklist
| ID | Information needed | Kind | Tier | Usually found in |
|---|---|---|---|---|
| SD-1.1 | Users | Issued | Core | Brief |
| SD-1.9 | Hardest uncertainty | Decision | Core | Decide |
| SD-3.2 | Actions per user | Measure | Full | Assume |
| ~~SD-3.9~~ | Retired item | Issued | Core | — |
| SD-7.4 | Prices | External | Core | Pricing pages |
"""

HEADER = (
    "| ID | Kind | Tier | Stage | Disposition | Evidence, reason or plan | Questions |\n"
    "|---|---|---|---|---|---|---|\n"
)


def question(qid, status, extra=""):
    return (
        "### %s — title\n- Stage: S1\n- Layer: product\n- Purpose: p\n- Sources: SD-1.9\n"
        "- Depends on: —\n- Status: %s\n%s" % (qid, status, extra)
    )


ANSWERED = "- Evidence: batch 1, 2026-10-08\n- Answer: prove routing\n- Decision: D-1\n"

GOOD_ROWS = (
    "| SD-1.1 | Issued | Core | S1 | answered | brief §2 | — |\n"
    "| SD-1.9 | Decision | Core | S1 | answered | D-1 | Q-001 |\n"
    "| SD-3.2 | Measure | Full | S3 | assumed | 10/day. Plan: count in demo trace | — |\n"
    "| SD-7.4 | External | Core | S5 | n/a | nothing paid; checked 2026-10-08 | — |\n"
)


OBS_HEADER = (
    "| Stage | What must be known | Items | Questions | Disposition | Evidence, reason or plan |\n"
    "|---|---|---|---|---|---|\n"
)

GOOD_OBS = (
    "| S1 | Recording policy | SD-1.1 | Q-001 | answered | D-1: no raw user text |\n"
    "| S3 | Workload classes to count | SD-3.2 | — | assumed | 10/day. Plan: count in trace |\n"
    "| S5 | Per-stage time and cost | SD-7.4 | — | n/a | light: local run log only |\n"
)


OUTPUT_ROWS = {
    "DO-1": "| DO-1 | System design | Ada | docs/design.md#System design | SD-1.9; Q-001 | planned | — |",
    "DO-2": "| DO-2 | Architecture | Ada | docs/design.md#Architecture | SD-1.1 | planned | — |",
    "DO-3": "| DO-3 | Code design | Ada | docs/design.md#Code design | SD-1.1 | planned | — |",
    "DO-4": "| DO-4 | Component contracts | Ada | docs/design.md#Contracts | SD-1.1 | planned | — |",
    "DO-5": "| DO-5 | Evaluation plan | Ada | docs/design.md#Evaluation plan | SD-1.9 | planned | — |",
    "DO-6": "| DO-6 | Observability contract | Ada | docs/design.md#Observability contract | SD-1.1 | planned | — |",
    "DO-7": "| DO-7 | Key-metrics registry | Ada | KEY_METRICS.md | SD-3.2 | planned | — |",
}


def outputs_register(drop=(), replace=None):
    replace = replace or {}
    rows = [replace.get(k, v) for k, v in sorted(OUTPUT_ROWS.items()) if k not in drop]
    return ("### Design outputs\n\n| ID | Output | Owner | Location | Sources | Status | Notes |\n"
            "|---|---|---|---|---|---|---|\n" + "\n".join(rows) + "\n\n")


GOOD_REGISTER = outputs_register()


def doc(rows=GOOD_ROWS, questions=None, obs=GOOD_OBS, register=GOOD_REGISTER):
    qs = questions if questions is not None else question("Q-001", "answered", ANSWERED)
    obs_section = "## Observability map\n\n%s%s\n" % (OBS_HEADER, obs) if obs is not None else ""
    artifact = "## Artifact map\n\n%s" % register if register is not None else ""
    return "# PRD interview\n\n%s## Questions\n\n%s\n%s## Checklist coverage\n\n%s%s" % (
        artifact, qs, obs_section, HEADER, rows)


def load_module():
    spec = importlib.util.spec_from_file_location("interview_under_test", INTERVIEW_PY)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class InterviewTestBase(unittest.TestCase):
    def setUp(self):
        self.m = load_module()
        self.td = TempDir().__enter__()
        self.checklist_path = self.td.write("CHECKLIST.md", CHECKLIST)
        self.items = self.m.load_checklist(self.checklist_path)

    def tearDown(self):
        self.td.__exit__(None, None, None)

    def problems(self, text, complete=False):
        return self.m.check(text, self.items, complete=complete)[0]

    def assertProblem(self, text, fragment, complete=False):
        found = self.problems(text, complete)
        self.assertTrue(any(fragment in p for p in found),
                        "expected a problem containing %r, got %r" % (fragment, found))


class ChecklistAndSkeleton(InterviewTestBase):
    def test_load_skips_struck_through_items(self):
        self.assertEqual([i["id"] for i in self.items], ["SD-1.1", "SD-1.9", "SD-3.2", "SD-7.4"])

    def test_default_stage_maps_step_and_moves_prices_to_s5(self):
        self.assertEqual(self.m.default_stage("SD-3.2"), "S3")
        self.assertEqual(self.m.default_stage("SD-7.4"), "S5")
        self.assertEqual(self.m.default_stage("SD-7.1"), "S7")

    def test_skeleton_has_one_tbd_row_per_item(self):
        out = self.m.skeleton(self.items)
        rows = [l for l in out.splitlines() if l.startswith("| SD-")]
        self.assertEqual(len(rows), 4)
        self.assertTrue(all("| TBD |" in r for r in rows))

    def test_skeleton_output_is_flagged_until_dispositioned(self):
        self.assertProblem(doc(rows=self.m.skeleton(self.items).split("\n", 2)[2]),
                           "disposition 'tbd'")

    def test_real_checklist_ids_are_unique_and_include_observability_items(self):
        if not os.path.isfile(REAL_CHECKLIST):
            self.skipTest("system-design-readiness is not beside this skill")
        ids = [i["id"] for i in self.m.load_checklist(REAL_CHECKLIST)]
        self.assertEqual(len(ids), 60)
        self.assertEqual(len(ids), len(set(ids)))
        for added in ("SD-1.10", "SD-2.8", "SD-4.7", "SD-6.6", "SD-7.6", "SD-8.7",
                      "SD-2.9", "SD-3.7", "SD-8.8", "SD-8.9"):
            self.assertIn(added, ids)


class CoverageChecks(InterviewTestBase):
    def test_good_document_has_no_problems_and_passes_the_gate(self):
        self.assertEqual(self.problems(doc()), [])
        self.assertEqual(self.problems(doc(), complete=True), [])

    def test_missing_item_is_reported(self):
        rows = "".join(l + "\n" for l in GOOD_ROWS.splitlines() if "SD-7.4" not in l)
        self.assertProblem(doc(rows=rows), "SD-7.4: missing from checklist coverage")

    def test_duplicate_and_unknown_items_are_reported(self):
        rows = GOOD_ROWS + "| SD-1.1 | Issued | Core | S1 | answered | brief | — |\n"
        self.assertProblem(doc(rows=rows), "SD-1.1: appears 2 times")
        rows = GOOD_ROWS + "| SD-9.9 | Issued | Core | S1 | answered | x | — |\n"
        self.assertProblem(doc(rows=rows), "not an item in the readiness checklist")

    def test_answered_and_na_need_evidence(self):
        rows = GOOD_ROWS.replace("| n/a | nothing paid; checked 2026-10-08 |", "| n/a | — |")
        self.assertProblem(doc(rows=rows), "SD-7.4 (line")

    def test_assumed_only_for_measure_items_and_needs_a_plan(self):
        rows = GOOD_ROWS.replace("| answered | brief §2 |", "| assumed | guess. Plan: ask |")
        self.assertProblem(doc(rows=rows), "assumed is allowed only for Measure items")
        rows = GOOD_ROWS.replace("10/day. Plan: count in demo trace", "10/day, no data yet")
        self.assertProblem(doc(rows=rows), "needs 'Plan:'")

    def test_pipe_inside_cell_is_reported(self):
        rows = GOOD_ROWS.replace("brief §2", "brief | §2")
        self.assertProblem(doc(rows=rows), "a '|' inside a cell?")

    def test_open_dispositions_pass_structure_but_fail_the_gate(self):
        rows = GOOD_ROWS.replace("| answered | brief §2 |", "| needs-research | ask the issuer |")
        self.assertEqual(self.problems(doc(rows=rows)), [])
        self.assertProblem(doc(rows=rows), "SD-1.1 (line", complete=True)

    def test_other_tables_mentioning_disposition_do_not_reset_the_header(self):
        text = doc().replace(
            "## Checklist coverage",
            "| Batch | Note |\n|---|---|\n| 1 | disposition changed |\n\n## Checklist coverage")
        self.assertEqual(self.problems(text), [])


class ObservabilityMapChecks(InterviewTestBase):
    def test_missing_map_is_reported(self):
        self.assertProblem(doc(obs=None), "Observability map is missing")

    def test_every_coverage_stage_needs_a_row(self):
        obs = "".join(l + "\n" for l in GOOD_OBS.splitlines() if not l.startswith("| S5"))
        self.assertProblem(doc(obs=obs), "observability S5: no Observability map row")

    def test_duplicate_stage_rows_are_reported(self):
        self.assertProblem(doc(obs=GOOD_OBS + GOOD_OBS.splitlines()[0] + "\n"),
                           "observability S1: appears 2 times")

    def test_row_needs_disposition_evidence_and_plan(self):
        self.assertProblem(doc(obs=GOOD_OBS.replace("| answered | D-1: no raw user text |",
                                                    "| TBD | |")), "disposition 'tbd'")
        self.assertProblem(doc(obs=GOOD_OBS.replace("10/day. Plan: count in trace", "10/day")),
                           "observability S3 (line")
        self.assertProblem(doc(obs=GOOD_OBS.replace("| n/a | light: local run log only |",
                                                    "| n/a | — |")), "n/a needs evidence")

    def test_unknown_references_are_reported(self):
        self.assertProblem(doc(obs=GOOD_OBS.replace("| SD-1.1 | Q-001 |", "| SD-9.9 | Q-077 |")),
                           "item SD-9.9 is not in the readiness checklist")
        self.assertProblem(doc(obs=GOOD_OBS.replace("| SD-1.1 | Q-001 |", "| SD-1.1 | Q-077 |")),
                           "refers to unknown question Q-077")

    def test_open_row_fails_only_the_gate(self):
        obs = GOOD_OBS.replace("| answered | D-1: no raw user text |",
                               "| needs-decision | retention not decided |")
        self.assertEqual(self.problems(doc(obs=obs)), [])
        self.assertProblem(doc(obs=obs), "observability S1 (line", complete=True)

    def test_stage_map_rows_are_not_mistaken_for_observability_rows(self):
        stage_map = ("## Stage map\n\n| Stage | Topics | Checklist items | Depends on | Depth | State |\n"
                     "|---|---|---|---|---|---|\n| S1 Frame | x | SD-1.1 | — | full | done |\n\n")
        self.assertEqual(self.problems(stage_map + doc()), [])


class DesignOutputsRegister(InterviewTestBase):
    def test_missing_register_is_reported_even_in_structure_mode(self):
        self.assertProblem(doc(register=None), "Design outputs register is missing")

    def test_answered_questions_do_not_compensate_for_missing_output_records(self):
        # Regression: every question answered, every checklist row and Observability map row
        # closed, yet the evaluation plan and metrics registry have no record. The interview
        # is not complete.
        text = doc(register=outputs_register(drop=("DO-5", "DO-7")))
        found = self.problems(text, complete=True)
        self.assertTrue(any("DO-5 (Evaluation plan): missing" in p for p in found), found)
        self.assertTrue(any("DO-7 (Key-metrics registry): missing" in p for p in found), found)
        self.assertFalse(any("still" in p for p in found), found)

    def test_unknown_location_passes_structure_but_fails_completion(self):
        text = doc(register=outputs_register(replace={
            "DO-6": "| DO-6 | Observability contract | Ada | unknown — ask | SD-1.1 | planned | — |"}))
        self.assertEqual(self.problems(text), [])
        self.assertProblem(text, "DO-6 (line", complete=True)

    def test_justified_na_output_completes(self):
        text = doc(register=outputs_register(replace={
            "DO-3": "| DO-3 | Code design | Ada | — | — | n/a | one 60-line script; the architecture names its functions |"}))
        self.assertEqual(self.problems(text, complete=True), [])


class QuestionChecks(InterviewTestBase):
    def test_invalid_status_and_missing_stage(self):
        self.assertProblem(doc(questions=question("Q-001", "maybe")), "status 'maybe'")
        q = question("Q-001", "answered", ANSWERED).replace("- Stage: S1\n", "")
        self.assertProblem(doc(questions=q), "Q-001 (line")

    def test_duplicate_ids_and_unknown_dependencies(self):
        qs = question("Q-001", "answered", ANSWERED) + "\n" + question("Q-001", "ready")
        self.assertProblem(doc(questions=qs), "Q-001: duplicate question ID")
        q = question("Q-001", "answered", ANSWERED).replace("Depends on: —", "Depends on: Q-099")
        self.assertProblem(doc(questions=q), "depends on unknown question Q-099")

    def test_answered_needs_evidence_and_answer(self):
        self.assertProblem(doc(questions=question("Q-001", "answered")), "answered needs evidence")

    def test_deferred_needs_a_destination(self):
        self.assertProblem(doc(questions=question("Q-001", "deferred")), "deferred needs a destination")

    def test_design_layer_questions_are_not_settled_here(self):
        q = question("Q-001", "answered", ANSWERED).replace("Layer: product", "Layer: design")
        self.assertProblem(doc(questions=q), "design-layer question")

    def test_coverage_reference_to_unknown_question(self):
        rows = GOOD_ROWS.replace("| D-1 | Q-001 |", "| D-1 | Q-002 |")
        self.assertProblem(doc(rows=rows), "refers to unknown question Q-002")

    def test_open_statuses_fail_only_the_gate(self):
        qs = question("Q-001", "answered", ANSWERED) + "\n" + question("Q-002", "provisional")
        self.assertEqual(self.problems(doc(questions=qs)), [])
        self.assertProblem(doc(questions=qs), "Q-002 (line", complete=True)
        qs = question("Q-001", "answered", ANSWERED) + "\n" + question("Q-002", "revisit")
        self.assertProblem(doc(questions=qs), "still revisit", complete=True)


class Cli(InterviewTestBase):
    def test_check_exit_codes(self):
        good = self.td.write("good.md", doc())
        bad = self.td.write("bad.md", doc(rows=""))
        ok = run([sys.executable, INTERVIEW_PY, "check", good, "--checklist", self.checklist_path,
                  "--complete"])
        self.assertEqual(ok.returncode, 0, ok.stdout + ok.stderr)
        self.assertIn("completion gate holds", ok.stdout)
        fail = run([sys.executable, INTERVIEW_PY, "check", bad, "--checklist", self.checklist_path])
        self.assertEqual(fail.returncode, 1)
        self.assertIn("missing from checklist coverage", fail.stdout)

    def test_missing_files_exit_2(self):
        r = run([sys.executable, INTERVIEW_PY, "skeleton", "--checklist",
                 os.path.join(self.td.path, "nope.md")])
        self.assertEqual(r.returncode, 2)
        r = run([sys.executable, INTERVIEW_PY, "check", os.path.join(self.td.path, "nope.md"),
                 "--checklist", self.checklist_path])
        self.assertEqual(r.returncode, 2)

    def test_template_parses_and_reports_only_expected_gaps(self):
        template = os.path.join(SKILL_ROOT, "templates", "interview.md")
        with open(template, encoding="utf-8") as f:
            text = f.read()
        problems = self.m.check(text, self.items)[0]
        # The empty template has no coverage rows yet and a placeholder question.
        self.assertTrue(any("missing from checklist coverage" in p for p in problems))
        self.assertFalse(any("duplicate" in p for p in problems))


if __name__ == "__main__":
    unittest.main()
