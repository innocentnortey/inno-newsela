"""Tests for scripts/design_outputs.py: register gates and minimum-content checks.

Stdlib only; run with `python3 -m unittest discover -s tests`. Every example is invented
("Lantern", a fictional quote service); no real project is read or changed.
"""
import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(SKILL_ROOT, "scripts", "design_outputs.py")
SPEC = os.path.join(SKILL_ROOT, "DESIGN-OUTPUTS.md")
TEMPLATES = os.path.join(SKILL_ROOT, "templates")


def load_module():
    spec = importlib.util.spec_from_file_location("design_outputs_under_test", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


m = load_module()
OUTPUTS = m.load_outputs(SPEC)

REGISTER_HEAD = (
    "## Design outputs\n\n"
    "| ID | Output | Owner | Location | Sources | Status | Notes |\n"
    "|---|---|---|---|---|---|---|\n"
)


def register(status="planned", overrides=None):
    rows = {
        "DO-1": "| DO-1 | System design | Ada | docs/design.md#System design | SD-1.9, SD-2.1 | %s | — |",
        "DO-2": "| DO-2 | Architecture | Ada | docs/design.md#Architecture | SD-4.1 | %s | — |",
        "DO-3": "| DO-3 | Code design | Ada | docs/design.md#Code design | SD-4.3 | %s | — |",
        "DO-4": "| DO-4 | Component contracts | Ada | docs/design.md#Contracts | SD-4.2 | %s | — |",
        "DO-5": "| DO-5 | Evaluation plan | Ada | docs/design.md#Evaluation plan | SD-8.1, SD-8.8 | %s | — |",
        "DO-6": "| DO-6 | Observability contract | Ada | docs/design.md#Observability contract | SD-3.7, SD-8.4 | %s | — |",
        "DO-7": "| DO-7 | Key-metrics registry | Ada | docs/design.md#Key metrics | SD-2.9 | %s | — |",
    }
    overrides = overrides or {}
    lines = []
    for rid in sorted(rows):
        if rid in overrides:
            if overrides[rid] is not None:
                lines.append(overrides[rid])
        else:
            lines.append(rows[rid] % status)
    return REGISTER_HEAD + "\n".join(lines) + "\n"


EVAL_PLAN = """## Evaluation plan

### Expected-answer authority
| Behaviour evaluated | Who or what decides | Where written |
|---|---|---|
| Route choice | The pricing rules in PRD §4 (deterministic) | PRD §4, D-3 |

### Case provenance
Hand-written from PRD §4 examples; each case file carries `provenance: prd-4.2`.

### Development and held-out separation
N/A — nothing is tuned against cases; routing is deterministic code.

### Scoring
| Suite | Grader | Case score | Roll-up |
|---|---|---|---|
| routing | assertion | pass/fail | all must pass |

### Failure categories
| Category | Means | Fix lives in |
|---|---|---|
| wrong-route | chose a route the rules forbid | router |

### Baselines
none yet — Plan: first run of the routing suite on the integration candidate.

### Acceptance conditions
Every routing case passes (invariant), tracked as M-2.

### Verification and evidence
`pytest tests/routing` — evidence: the run log under var/eval/.
"""

OBS_CONTRACT = """## Observability contract

### Covered workflows
| Workflow | Entry point | Class | Emitting components | Correlation | Required records | Capture verification | Eval and metrics |
|---|---|---|---|---|---|---|---|
| WF-1 | POST /quote | user-operation | api, router | run_id minted by api | quote.received, route.decided | test_quote_capture | routing suite; M-1, M-2 |
| WF-2 | nightly refresh job | background-job | refresher | run_id per job run | refresh.started, refresh.finished | test_refresh_capture | n/a — refresh has no expected answer; M-1 only counts quotes |
| WF-3 | pytest tests/routing | validation | eval runner | eval_run_id | eval.case, eval.summary | test_eval_capture | routing suite; M-2 |
| WF-4 | scripts/try_weights.py | development-experiment | experiment runner, router | experiment_id + run_id | experiment.config, route.decided | test_experiment_capture | routing suite dev split; M-2 |

| Class | Present | Workflows or reason |
|---|---|---|
| user-operation | yes | WF-1 |
| background-job | yes | WF-2 |
| validation | yes | WF-3 |
| development-experiment | yes | WF-4 |
| runtime-operation | no | No deploy, migration or backfill tooling exists; one local process |

### Correlation across boundaries
The api mints run_id and passes it to the router and ledger as an argument.

### Storage and access
JSON lines under var/logs, kept 14 days, readable by the developer only.

### Content and redaction
No customer names in records; quote amounts allowed.

### Missing instrumentation
A daily check compares quote.received with route.decided counts and fails on mismatch.

### Capture verification
Each WF row names a test that drives the real entry point and asserts its records.

### Registering a new workflow
Add a WF row, name inherited evals and metrics, add its capture test, cite the WF in the ticket.
"""

METRICS = """## Key metrics

| Metric | Name | Kind | Purpose | Formula | Population / denominator | Unit | Source | Owner | Decision informed | Baseline | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| M-1 | Quote completion | operational | Did quotes finish | completed / received | quote requests received per day | % | WF-1 records | Ada | add a retry or not | none yet — Plan: first demo day | measurement-only |
| M-2 | Routing correctness | correctness | Was the route right | cases passed / cases run | routing suite cases | % | eval summary | Ada | ship or hold | none yet — Plan: first suite run | 100% — approved D-7 |
"""


class TempDir:
    def __enter__(self):
        self.path = tempfile.mkdtemp(prefix="design-outputs-test-")
        return self

    def __exit__(self, *exc):
        shutil.rmtree(self.path, ignore_errors=True)

    def write(self, rel, content):
        full = os.path.join(self.path, rel)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(content)
        return full


def assert_problem(test, problems, fragment):
    test.assertTrue(any(fragment in p for p in problems),
                    "expected a problem containing %r, got %r" % (fragment, problems))


class Spec(unittest.TestCase):
    def test_spec_lists_seven_outputs(self):
        self.assertEqual([o["id"] for o in OUTPUTS], ["DO-%d" % n for n in range(1, 8)])
        self.assertEqual(OUTPUTS[4]["name"], "Evaluation plan")

    def test_skeleton_round_trips_as_a_structural_register(self):
        problems = m.check_register(m.skeleton(OUTPUTS), OUTPUTS)
        self.assertEqual(problems, [])


class RegisterGates(unittest.TestCase):
    def test_missing_register_is_reported(self):
        assert_problem(self, m.check_register("# Design\n", OUTPUTS), "register is missing")

    def test_missing_unknown_and_duplicate_rows(self):
        assert_problem(self, m.check_register(register(overrides={"DO-6": None}), OUTPUTS),
                       "DO-6 (Observability contract): missing")
        extra = register() + "| DO-9 | Extra | Ada | x.md | SD-1.1 | planned | — |\n"
        assert_problem(self, m.check_register(extra, OUTPUTS), "not a required output")

    def test_interview_gate_needs_owner_and_known_location(self):
        reg = register(overrides={"DO-5": "| DO-5 | Evaluation plan | Ada | unknown — ask | SD-8.1 | planned | — |"})
        self.assertEqual(m.check_register(reg, OUTPUTS), [])
        assert_problem(self, m.check_register(reg, OUTPUTS, gate="interview"), "DO-5 (line")

    def test_readiness_gate_needs_a_readiness_item_in_sources(self):
        reg = register(overrides={"DO-7": "| DO-7 | Key-metrics registry | Ada | KEY_METRICS.md | PRD §6 | planned | — |"})
        self.assertEqual(m.check_register(reg, OUTPUTS, gate="interview"), [])
        assert_problem(self, m.check_register(reg, OUTPUTS, gate="readiness"),
                       "cite no readiness item")

    def test_na_needs_a_real_reason(self):
        bad = register(overrides={"DO-3": "| DO-3 | Code design | — | — | — | n/a | not needed |"})
        assert_problem(self, m.check_register(bad, OUTPUTS, gate="interview"), "n/a needs a reason")
        good = register(overrides={"DO-3": "| DO-3 | Code design | Ada | — | — | n/a | single 80-line script; architecture names its two functions |"})
        self.assertEqual(m.check_register(good, OUTPUTS, gate="readiness"), [])

    def test_tickets_gate_needs_every_output_ready(self):
        assert_problem(self, m.check_register(register("draft"), OUTPUTS, gate="tickets"),
                       "tickets need every output ready or n/a")


class TicketsGateContent(unittest.TestCase):
    def doc(self, eval_plan=EVAL_PLAN, obs=OBS_CONTRACT, metrics=METRICS):
        body = ("# Lantern design\n\n## System design\nx\n\n## Architecture\nx\n\n## Code design\nx\n\n"
                "## Contracts\nx\n\n" + eval_plan + "\n" + obs + "\n" + metrics)
        return body

    def run_gate(self, design_text):
        with TempDir() as td:
            td.write("docs/design.md", design_text)
            return m.check_register(register("ready"), OUTPUTS, gate="tickets", root=td.path)

    def test_complete_small_project_passes(self):
        self.assertEqual(self.run_gate(self.doc()), [])

    def test_ready_status_does_not_excuse_missing_content(self):
        no_eval = self.doc(eval_plan=EVAL_PLAN.replace(
            "### Failure categories\n| Category | Means | Fix lives in |\n|---|---|---|\n"
            "| wrong-route | chose a route the rules forbid | router |\n", ""))
        assert_problem(self, self.run_gate(no_eval), "DO-5: evaluation plan: missing section 'failure categories'")

    def test_unreadable_location_is_reported(self):
        with TempDir() as td:
            problems = m.check_register(register("ready"), OUTPUTS, gate="tickets", root=td.path)
        assert_problem(self, problems, "cannot be read")


class EvaluationPlan(unittest.TestCase):
    def test_good_plan_passes(self):
        self.assertEqual(m.check_evaluation_plan(EVAL_PLAN), [])

    def test_held_out_may_be_na_only_with_a_reason(self):
        text = EVAL_PLAN.replace("N/A — nothing is tuned against cases; routing is deterministic code.",
                                 "N/A")
        assert_problem(self, m.check_evaluation_plan(text), "N/A without a reason")

    def test_authority_cannot_be_na(self):
        text = EVAL_PLAN.replace("| Route choice | The pricing rules in PRD §4 (deterministic) | PRD §4, D-3 |",
                                 "N/A — the model knows")
        assert_problem(self, m.check_evaluation_plan(text), "cannot be N/A")

    def test_template_is_reported_as_unfilled(self):
        with open(os.path.join(TEMPLATES, "evaluation-plan.md"), encoding="utf-8") as f:
            problems = m.check_evaluation_plan(f.read())
        self.assertEqual(len(problems), 8, problems)


class ObservabilityContract(unittest.TestCase):
    def test_good_contract_passes(self):
        self.assertEqual(m.check_observability_contract(OBS_CONTRACT), [])

    def test_new_experiment_cannot_bypass_the_registry(self):
        # Regression: an experiment exists but nobody registered it. Marking the class absent
        # is caught, and so is listing it without a registry row.
        text = OBS_CONTRACT.replace(
            "| development-experiment | yes | WF-4 |",
            "| development-experiment | yes | WF-4, WF-5 |")
        assert_problem(self, m.check_observability_contract(text),
                       "lists WF-5, which is not a development-experiment row")
        text = OBS_CONTRACT.replace(
            "| development-experiment | yes | WF-4 |",
            "| development-experiment | no | experiments are informal and run by hand |")
        assert_problem(self, m.check_observability_contract(text),
                       "marked absent but the registry has WF-4")

    def test_every_class_needs_a_row(self):
        text = OBS_CONTRACT.replace(
            "| runtime-operation | no | No deploy, migration or backfill tooling exists; one local process |\n", "")
        assert_problem(self, m.check_observability_contract(text), "class runtime-operation has no row")

    def test_absent_class_needs_a_reason(self):
        text = OBS_CONTRACT.replace("No deploy, migration or backfill tooling exists; one local process", "none")
        assert_problem(self, m.check_observability_contract(text), "absent without a reason")

    def test_workflow_row_must_name_capture_and_inheritance(self):
        text = OBS_CONTRACT.replace("| test_experiment_capture | routing suite dev split; M-2 |",
                                    "| — | — |")
        problems = m.check_observability_contract(text)
        assert_problem(self, problems, "'capture verification' must be filled")
        assert_problem(self, problems, "name the evaluation and metrics it inherits")

    def test_missing_instrumentation_section_is_required(self):
        text = OBS_CONTRACT.replace(
            "### Missing instrumentation\nA daily check compares quote.received with route.decided "
            "counts and fails on mismatch.\n", "")
        assert_problem(self, m.check_observability_contract(text), "missing section 'missing instrumentation'")


class MetricsRegistry(unittest.TestCase):
    def test_good_registry_passes(self):
        self.assertEqual(m.check_metrics_registry(METRICS), [])

    def test_metric_without_denominator_is_incomplete(self):
        text = METRICS.replace("| quote requests received per day |", "| |")
        assert_problem(self, m.check_metrics_registry(text),
                       "M-1 (line 5): no population or denominator")
        text = METRICS.replace("| quote requests received per day |", "| n/a — it is a ratio |")
        assert_problem(self, m.check_metrics_registry(text), "cannot be n/a")

    def test_target_needs_approval_or_measurement_only(self):
        text = METRICS.replace("100% — approved D-7", "95%")
        assert_problem(self, m.check_metrics_registry(text), "has no approval")

    def test_kind_is_exactly_one_distinct_category(self):
        text = METRICS.replace("| operational |", "| operational/correctness |")
        assert_problem(self, m.check_metrics_registry(text), "must be exactly one of")

    def test_none_baseline_needs_a_plan(self):
        text = METRICS.replace("none yet — Plan: first demo day", "none yet")
        assert_problem(self, m.check_metrics_registry(text), "needs 'Plan:'")


class ReviewProbes(unittest.TestCase):
    """Inputs an independent review showed passing falsely (2026-10-11); each must now fail."""

    def test_non_answers_do_not_count_as_a_denominator(self):
        for value in ("none", "not applicable", "NA", "<population>"):
            text = METRICS.replace("| quote requests received per day |", "| %s |" % value)
            assert_problem(self, m.check_metrics_registry(text), "M-1 (line 5)")

    def test_experiment_row_of_nones_is_not_observability(self):
        text = OBS_CONTRACT.replace(
            "| WF-4 | scripts/try_weights.py | development-experiment | experiment runner, router | "
            "experiment_id + run_id | experiment.config, route.decided | test_experiment_capture | "
            "routing suite dev split; M-2 |",
            "| WF-4 | scripts/try_weights.py | development-experiment | none | none | none | none | none |")
        problems = m.check_observability_contract(text)
        assert_problem(self, problems, "WF-4 (line")
        assert_problem(self, problems, "'capture verification' must be filled")

    def test_unapproved_targets_are_rejected(self):
        for target in ("0.95 (not approved yet)", "approved tbd", "95% — approved soon"):
            text = METRICS.replace("100% — approved D-7", target)
            assert_problem(self, m.check_metrics_registry(text), "has no approval")

    def test_evaluation_sections_cannot_be_none_or_one_word(self):
        text = EVAL_PLAN.replace(
            "Hand-written from PRD §4 examples; each case file carries `provenance: prd-4.2`.", "None.")
        assert_problem(self, m.check_evaluation_plan(text), "case provenance")
        text = EVAL_PLAN.replace(
            "Hand-written from PRD §4 examples; each case file carries `provenance: prd-4.2`.", "Handwritten.")
        assert_problem(self, m.check_evaluation_plan(text), "says too little")
        text = EVAL_PLAN.replace(
            "Hand-written from PRD §4 examples; each case file carries `provenance: prd-4.2`.",
            "Not applicable — cases are obvious")
        assert_problem(self, m.check_evaluation_plan(text), "cannot be N/A")

    def test_missing_eval_baseline_needs_a_plan(self):
        text = EVAL_PLAN.replace(
            "none yet — Plan: first run of the routing suite on the integration candidate.",
            "none yet, we will see")
        assert_problem(self, m.check_evaluation_plan(text), "missing baseline needs 'Plan:'")

    def test_register_inside_a_code_fence_does_not_count(self):
        fenced = "# Design\n\n```markdown\n" + register() + "```\n"
        assert_problem(self, m.check_register(fenced, OUTPUTS, gate="interview"), "register is missing")

    def test_na_output_needs_an_owner_at_a_gate(self):
        reg = register(overrides={"DO-5": "| DO-5 | Evaluation plan | | | | n/a | nothing here is ever evaluated at all |"})
        assert_problem(self, m.check_register(reg, OUTPUTS, gate="interview"), "n/a needs an Owner")

    def test_malformed_ids_are_reported_not_dropped(self):
        text = OBS_CONTRACT.replace("| WF-2 | nightly refresh job |", "| Nightly (WF-2) | nightly refresh job |")
        assert_problem(self, m.check_observability_contract(text), "is not WF-n")
        text = METRICS.replace("| M-1 | Quote completion |", "| Quote rate | Quote completion |")
        assert_problem(self, m.check_metrics_registry(text), "is not M-n")


class Cli(unittest.TestCase):
    def run_cli(self, *args, cwd=None):
        return subprocess.run([sys.executable, SCRIPT] + list(args), capture_output=True,
                              text=True, cwd=cwd)

    def test_check_gate_exit_codes(self):
        with TempDir() as td:
            reg = td.write("register.md", register())
            ok = self.run_cli("check", reg, "--gate", "interview", "--root", td.path)
            self.assertEqual(ok.returncode, 0, ok.stdout)
            fail = self.run_cli("check", reg, "--gate", "tickets", "--root", td.path)
            self.assertEqual(fail.returncode, 1)
            self.assertIn("tickets need every output ready", fail.stdout)

    def test_content_subcommands_accept_a_heading_anchor(self):
        with TempDir() as td:
            td.write("design.md", "# Lantern\n\n" + METRICS)
            r = self.run_cli("check-metrics", "design.md#Key metrics", cwd=td.path)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            r = self.run_cli("check-metrics", "design.md#Nope", cwd=td.path)
            self.assertEqual(r.returncode, 2)

    def test_missing_files_exit_2(self):
        r = self.run_cli("check", "/nonexistent/register.md")
        self.assertEqual(r.returncode, 2)


if __name__ == "__main__":
    unittest.main()
