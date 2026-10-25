"""Tests for scripts/coverage_audit.py: the full-set coverage audit and plan reconciliation.

Stdlib only; run with `python3 -m unittest discover -s tests`. Every example is invented
("Lantern", a fictional quote service with tickets LAN-01..LAN-05); no real project is read.
"""
import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(SKILL_ROOT, "scripts", "coverage_audit.py")
TEMPLATES = os.path.join(SKILL_ROOT, "templates")


def load_module():
    spec = importlib.util.spec_from_file_location("coverage_audit_under_test", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


m = load_module()

REGISTRY = """## Covered workflows

| Workflow | Entry point | Class | Emitting components | Correlation | Required records | Capture verification | Eval and metrics |
|---|---|---|---|---|---|---|---|
| WF-1 | POST /quote | user-operation | api, router | run_id | quote.received | test_quote_capture | routing suite; M-1 |
| WF-2 | nightly refresh | background-job | refresher | run_id | refresh.finished | test_refresh_capture | n/a — refresh has no expected answer to score |
| WF-4 | scripts/try_weights.py | development-experiment | runner, router | experiment_id | experiment.config | test_experiment_capture | routing dev split; M-2 |
"""
WORKFLOWS = m.parse_workflows([REGISTRY])

NA_ALL = """### Observability
N/A — documentation only; no code path runs or emits anything.

### Evaluation
N/A — documentation only; no behaviour has an expected answer.

### Metrics
N/A — documentation only; no metric is computed or changed.
"""


def ticket(tid, title, acs, blocked="None", entry="None", obs=None, ev=None, metrics=None,
           contract=None):
    obs = obs or ("- Responsibilities: emit run_id on every record of %s\n"
                  "- Capture evidence: %s drives the real entry point" % (entry, acs[-1][0]))
    ev = ev or "- Checks: routing suite cases for this path\n- Expected-answer authority: PRD §4 rules"
    metrics = metrics or "- References: M-1\n- Acceptance conditions: M-1 is computable from the records"
    contract_block = contract if contract is not None else (
        "### Observability\n%s\n\n### Evaluation\n%s\n\n### Metrics\n%s\n" % (obs, ev, metrics))
    ac_lines = "\n".join("- [ ] %s [invariant] %s — verify: %s — evidence: %s" % a for a in acs)
    return ("## [%s] %s\n\n### What to build\nx\n\n### Acceptance criteria\n%s\n\n%s\n"
            "### Blocked by\n%s\n\n### Agent handoff\n- Area / owner: lantern\n"
            "- Entry points added or changed: %s\n\n" % (tid, title, ac_lines, contract_block,
                                                        blocked, entry))


def ticket_set(**overrides):
    tickets = {
        "LAN-01": ticket("LAN-01", "obs: trace adapter", [
            ("AC-1", "adapter stamps run_id", "test_adapter", "pytest output")],
            metrics="- References: M-1\n- Acceptance conditions: records carry the fields M-1 counts"),
        "LAN-02": ticket("LAN-02", "quote: wire adapter and redactor into POST /quote", [
            ("AC-1", "quote returns a route", "test_quote", "pytest output"),
            ("AC-2", "every WF-1 record carries run_id", "test_quote_capture", "captured records"),
            ("AC-3", "no customer name in WF-1 records", "test_no_customer_name", "negative capture")],
            blocked="LAN-01", entry="WF-1 (changed: instrumented)"),
        "LAN-03": ticket("LAN-03", "refresh: wire adapter into nightly refresh", [
            ("AC-1", "every WF-2 record carries run_id", "test_refresh_capture", "captured records")],
            blocked="LAN-01", entry="WF-2",
            ev="N/A — the refresh has no expected answer; only capture is in scope here",
            metrics="N/A — no metric is computed from refresh records in this release"),
        "LAN-04": ticket("LAN-04", "docs: README quickstart", [
            ("AC-1", "README explains how to run a quote", "read-back", "diff")],
            contract=NA_ALL),
        "LAN-05": ticket("LAN-05", "experiment: weight sweep script", [
            ("AC-1", "every WF-4 record carries run_id and experiment_id", "test_experiment_capture",
             "captured records")],
            blocked="LAN-01", entry="WF-4",
            metrics="- References: M-2\n- Acceptance conditions: sweep report shows M-2 per setting"),
    }
    tickets.update(overrides)
    return "# Lantern draft issues\n\n" + "".join(v for k, v in sorted(tickets.items()) if v)


REQS = """## Mandatory requirements

| Req | Requirement | Source | Applies to |
|---|---|---|---|
| R-1 | Every workflow run stamps its run_id on each record | requirements §5 OBS-1 | all |
| R-2 | Quote records hold no customer names | requirements §5 OBS-3 | WF-1; excludes WF-2, WF-4 (they never receive customer data) |
"""

MATRIX_HEAD = """## Coverage matrix

| Req | Workflow | Component / contract | Implementing ticket | Integration owner | Acceptance criterion | Evidence |
|---|---|---|---|---|---|---|
"""
GOOD_MATRIX = (
    "| R-1 | WF-1 | TraceAdapter (C-2) | LAN-01 | LAN-02 | LAN-02 AC-2 | captured WF-1 records |\n"
    "| R-1 | WF-2 | TraceAdapter (C-2) | LAN-01 | LAN-03 | LAN-03 AC-1 | captured WF-2 records |\n"
    "| R-1 | WF-4 | TraceAdapter (C-2) | LAN-01 | LAN-05 | LAN-05 AC-1 | captured WF-4 records |\n"
    "| R-2 | WF-1 | Redactor (C-3) | LAN-02 | LAN-02 | LAN-02 AC-3 | negative capture |\n"
)


def audit(matrix=GOOD_MATRIX, reqs=REQS):
    return "# Coverage audit\n\n" + reqs + "\n" + MATRIX_HEAD + matrix


def problems(audit_text=None, tickets_text=None, stage="publish", workflows=WORKFLOWS):
    tickets = m.parse_tickets(tickets_text or ticket_set())
    return (m.check_tickets(tickets, workflows)
            + m.check_audit(audit_text or audit(), tickets, workflows, stage))


def assert_problem(test, found, fragment):
    test.assertTrue(any(fragment in p for p in found),
                    "expected a problem containing %r, got %r" % (fragment, found))


class GoodSet(unittest.TestCase):
    def test_complete_set_has_no_problems(self):
        self.assertEqual(problems(), [])

    def test_every_ticket_is_checked_not_a_sample(self):
        # The defect sits in the last ticket of the set.
        broken = ticket_set(
            **{"LAN-05": ticket("LAN-05", "experiment", [("AC-1", "x", "t", "e")],
                                blocked="LAN-01", entry="WF-4",
                                contract="### Observability\n- Responsibilities: r\n"
                                         "- Capture evidence: c\n\n### Evaluation\n"
                                         "- Checks: c\n- Expected-answer authority: PRD\n")})
        assert_problem(self, problems(tickets_text=broken), "LAN-05: no 'Metrics' section")


class AdapterOnly(unittest.TestCase):
    def test_adapter_demo_does_not_satisfy_missing_consumers(self):
        # Regression: the shared adapter works and has a passing test, but no ticket wires it
        # into the quote, refresh or experiment workflows.
        matrix = ("| R-1 | — | TraceAdapter (C-2) | LAN-01 | | LAN-01 AC-1 | adapter test passes |\n"
                  "| R-2 | WF-1 | Redactor (C-3) | LAN-02 | LAN-02 | LAN-02 AC-3 | negative capture |\n")
        found = problems(audit(matrix=matrix))
        assert_problem(self, found, "needs exactly one consuming workflow")
        assert_problem(self, found, "unowned integration")
        for wf in ("WF-1", "WF-2", "WF-4"):
            assert_problem(self, found, "R-1: no coverage row for %s — missing consumer" % wf)

    def test_component_ac_does_not_prove_integration(self):
        matrix = GOOD_MATRIX.replace("| LAN-03 | LAN-03 AC-1 |", "| LAN-03 | LAN-01 AC-1 |")
        assert_problem(self, problems(audit(matrix=matrix)),
                       "LAN-01 AC-1 proves the component, not its use in WF-2")

    def test_integration_owner_must_depend_on_the_component(self):
        tickets = ticket_set(**{"LAN-03": ticket(
            "LAN-03", "refresh", [("AC-1", "run_id on WF-2", "t", "e")], blocked="None",
            entry="WF-2", ev="N/A — the refresh has no expected answer to score",
            metrics="N/A — no metric is computed from refresh records")})
        assert_problem(self, problems(tickets_text=tickets),
                       "LAN-03 integrates LAN-01's component but is not blocked by LAN-01")


class NarrowedGuarantees(unittest.TestCase):
    def test_every_requirement_scoped_to_one_workflow_is_flagged(self):
        reqs = REQS.replace("| requirements §5 OBS-1 | all |", "| requirements §5 OBS-1 | WF-1 |")
        assert_problem(self, problems(audit(reqs=reqs)), "narrowed guarantee")

    def test_explicit_exclusion_with_reason_is_accepted(self):
        reqs = REQS.replace("| requirements §5 OBS-1 | all |",
                            "| requirements §5 OBS-1 | WF-1, WF-2; excludes WF-4 (sweeps are throwaway local runs) |")
        matrix = "".join(l + "\n" for l in GOOD_MATRIX.splitlines() if "WF-4" not in l)
        self.assertEqual(problems(audit(matrix=matrix, reqs=reqs)), [])

    def test_only_with_reason_scopes_an_operation_specific_rule(self):
        reqs = REQS.replace("WF-1; excludes WF-2, WF-4 (they never receive customer data)",
                            "WF-1 only — quotes are the only records that can hold a name")
        self.assertEqual(problems(audit(reqs=reqs)), [])
        reqs = REQS.replace("WF-1; excludes WF-2, WF-4 (they never receive customer data)",
                            "WF-1 only")
        assert_problem(self, problems(audit(reqs=reqs)), "without a reason")

    def test_na_inheritance_cell_mentioning_a_metric_is_not_inheritance(self):
        registry = REGISTRY.replace("| n/a — refresh has no expected answer to score |",
                                    "| n/a — refresh feeds no metric; M-1 counts quotes only |")
        self.assertEqual(problems(workflows=m.parse_workflows([registry])), [])

    def test_exclusion_without_reason_is_flagged(self):
        reqs = REQS.replace("WF-1; excludes WF-2, WF-4 (they never receive customer data)",
                            "WF-1; excludes WF-2, WF-4")
        assert_problem(self, problems(audit(reqs=reqs)), "excludes WF-2, WF-4 without a reason")


class JustifiedNA(unittest.TestCase):
    def test_documentation_ticket_may_be_na_with_reasons(self):
        found = problems()
        self.assertFalse(any(p.startswith("LAN-04") for p in found), found)

    def test_bare_na_is_rejected(self):
        bare = NA_ALL.replace("N/A — documentation only; no metric is computed or changed.", "N/A")
        tickets = ticket_set(**{"LAN-04": ticket("LAN-04", "docs", [("AC-1", "x", "t", "e")],
                                                 contract=bare)})
        assert_problem(self, problems(tickets_text=tickets), "LAN-04: Metrics is N/A without a reason")

    def test_filled_section_needs_its_fields(self):
        tickets = ticket_set(**{"LAN-02": ticket(
            "LAN-02", "quote", [("AC-1", "a", "t", "e"), ("AC-2", "b", "t", "e"), ("AC-3", "c", "t", "e")],
            blocked="LAN-01", entry="WF-1", ev="- Checks: routing suite")})
        assert_problem(self, problems(tickets_text=tickets),
                       "LAN-02: Evaluation needs 'Expected-answer authority:'")


class NewExperiments(unittest.TestCase):
    def test_unregistered_experiment_is_flagged(self):
        # Regression: a new sweep script ships with no workflow registry row.
        new = ticket("LAN-06", "experiment: temperature sweep", [("AC-1", "sweep runs", "t", "e")],
                     entry="scripts/temp_sweep.py (new experiment)")
        assert_problem(self, problems(tickets_text=ticket_set(**{"LAN-06": new})),
                       "LAN-06: entry point 'scripts/temp_sweep.py (new experiment)' has no registered WF-n")

    def test_unknown_workflow_id_is_flagged(self):
        new = ticket("LAN-06", "experiment", [("AC-1", "x", "t", "e")], entry="WF-9")
        assert_problem(self, problems(tickets_text=ticket_set(**{"LAN-06": new})),
                       "entry point WF-9 is not in the observability contract")

    def test_registered_experiment_cannot_declare_observability_na(self):
        new = ticket("LAN-06", "experiment", [("AC-1", "x", "t", "e")], entry="WF-4",
                     obs="N/A — it is only an experiment, nobody reads it",
                     metrics="- References: M-2\n- Acceptance conditions: M-2 per setting")
        assert_problem(self, problems(tickets_text=ticket_set(**{"LAN-06": new})),
                       "LAN-06: adds or changes WF-4 but declares Observability N/A")

    def test_inherited_metric_must_be_referenced(self):
        tickets = ticket_set(**{"LAN-05": ticket(
            "LAN-05", "experiment", [("AC-1", "x", "t", "e")], blocked="LAN-01", entry="WF-4",
            metrics="- References: M-1\n- Acceptance conditions: c")})
        assert_problem(self, problems(tickets_text=tickets), "Metrics does not reference M-2")

    def test_missing_entry_point_line_is_flagged(self):
        text = ticket_set().replace("- Entry points added or changed: None\n\n## [LAN-05]", "\n## [LAN-05]")
        assert_problem(self, problems(tickets_text=text), "no 'Entry points added or changed:' line")


class ReviewProbes(unittest.TestCase):
    """Inputs an independent review showed passing falsely (2026-10-11); each must now fail."""

    def test_component_ticket_cannot_self_certify_every_workflow(self):
        matrix = ("| R-1 | WF-1 | TraceAdapter | LAN-01 | LAN-01 | LAN-01 AC-1 | adapter test |\n"
                  "| R-1 | WF-2 | TraceAdapter | LAN-01 | LAN-01 | LAN-01 AC-1 | adapter test |\n"
                  "| R-1 | WF-4 | TraceAdapter | LAN-01 | LAN-01 | LAN-01 AC-1 | adapter test |\n"
                  "| R-2 | WF-1 | Redactor (C-3) | LAN-02 | LAN-02 | LAN-02 AC-3 | negative capture |\n")
        found = problems(audit(matrix=matrix), stage="verify")
        assert_problem(self, found, "LAN-01 AC-1 does not name WF-1")
        assert_problem(self, found, "is already the proof for WF-1")

    def test_entry_point_ticket_cannot_opt_out_field_by_field(self):
        new = ticket("LAN-06", "experiment", [("AC-1", "sweep works", "t", "e")], entry="WF-4",
                     obs="- Responsibilities: N/A\n- Capture evidence: none",
                     metrics="- References: M-2\n- Acceptance conditions: c")
        found = problems(tickets_text=ticket_set(**{"LAN-06": new}))
        assert_problem(self, found, "LAN-06: Observability needs 'Responsibilities:'")
        assert_problem(self, found, "LAN-06: Observability needs 'Capture evidence:'")

    def test_entry_point_ticket_must_name_its_workflow_and_cite_a_real_ac(self):
        new = ticket("LAN-06", "experiment", [("AC-1", "sweep works", "t", "e")], entry="WF-4",
                     obs="- Responsibilities: log some things\n- Capture evidence: AC-9 somewhere",
                     metrics="- References: M-2\n- Acceptance conditions: c")
        found = problems(tickets_text=ticket_set(**{"LAN-06": new}))
        assert_problem(self, found, "responsibilities do not name WF-4")
        assert_problem(self, found, "must cite this ticket's capture AC-n for WF-4")

    def test_inherited_evaluation_cannot_be_dropped(self):
        new = ticket("LAN-06", "quote tweak", [("AC-1", "every WF-1 record kept", "t", "e")],
                     entry="WF-1", ev="N/A — evaluation is somebody else's problem today")
        assert_problem(self, problems(tickets_text=ticket_set(**{"LAN-06": new})),
                       "WF-1 inherits evaluation")

    def test_placeholder_reasons_and_verified_placeholders_are_rejected(self):
        bare = NA_ALL.replace("N/A — documentation only; no metric is computed or changed.",
                              "N/A — <why this does not apply>")
        tickets = ticket_set(**{"LAN-04": ticket("LAN-04", "docs", [("AC-1", "x", "t", "e")],
                                                 contract=bare)})
        assert_problem(self, problems(tickets_text=tickets), "LAN-04: Metrics is N/A without a reason")
        matrix = GOOD_MATRIX.replace("| captured WF-1 records |", "| verified: <link or run> |")
        assert_problem(self, problems(audit(matrix=matrix), stage="verify"), "evidence not verified")

    def test_blank_and_duplicate_requirement_ids_are_reported(self):
        reqs = REQS + "| | Every quote is priced in USD | PRD §2 | WF-1 only — prices exist only on quotes |\n"
        assert_problem(self, problems(audit(reqs=reqs)), "has text but no Req id")
        reqs = REQS + "| R-1 | Duplicate | PRD §9 | WF-1 only — narrow duplicate for testing |\n"
        assert_problem(self, problems(audit(reqs=reqs)), "duplicate Req id")

    def test_matrix_inside_a_code_fence_does_not_count(self):
        text = "# Coverage audit\n\n" + REQS + "\n```\n" + MATRIX_HEAD + GOOD_MATRIX + "```\n"
        assert_problem(self, problems(text), "coverage matrix is missing")

    def test_plan_registration_needs_the_registry_and_its_metrics(self):
        found, _ = m.check_plan(GOOD_PLAN, None)
        assert_problem(self, found, "pass --workflows")
        plan = GOOD_PLAN.replace("| nightly refresh | WF-2 | yes | n/a — no eval or metric |",
                                 "| weight sweep | WF-4 | yes | routing dev split |")
        found, _ = m.check_plan(plan, WORKFLOWS)
        assert_problem(self, found, "the plan omits M-2")

    def test_plan_sources_must_say_what_they_oblige(self):
        plan = GOOD_PLAN.replace("| C-2 adapter signature |", "| |")
        found, _ = m.check_plan(plan, WORKFLOWS)
        assert_problem(self, found, "'component contracts' must say what it obliges")


class Verification(unittest.TestCase):
    def test_verify_stage_needs_verified_evidence(self):
        assert_problem(self, problems(stage="verify"), "evidence not verified")
        verified = GOOD_MATRIX.replace("| captured", "| verified: captured").replace(
            "| negative capture |", "| verified: negative capture run 12 |")
        self.assertEqual(problems(audit(matrix=verified), stage="verify"), [])

    def test_acs_need_ids_verify_and_evidence(self):
        text = ticket_set().replace("- [ ] AC-1 [invariant] README explains",
                                    "- [ ] [invariant] README explains")
        assert_problem(self, problems(tickets_text=text), "acceptance criterion without an AC-n id")


AC2_ONE_LINE = ("- [ ] AC-2 [invariant] every WF-1 record carries run_id — verify: "
                "test_quote_capture — evidence: captured records")


class WrappedCriteria(unittest.TestCase):
    """A criterion wrapped over indented continuation lines is read as one criterion."""

    def test_wrapped_criterion_passes(self):
        wrapped = ("- [ ] AC-2 [invariant] every quote record carries run_id\n"
                   "  on WF-1 — verify: `uv sync` then\n"
                   "  `uv run pytest tests/unit/test_quote.py::test_quote_capture`\n"
                   "  — evidence: both commands exit 0.")
        text = ticket_set().replace(AC2_ONE_LINE, wrapped)
        self.assertNotEqual(text, ticket_set())
        # WF-1 appears only on a continuation line, so the matrix's WF-mention check needs it too.
        self.assertEqual(problems(tickets_text=text), [])

    def test_wrapped_capture_evidence_cites_its_ac(self):
        text = ticket_set().replace(
            "- Capture evidence: AC-3 drives the real entry point",
            "- Capture evidence: the negative capture test drives the real\n  entry point (AC-3)")
        self.assertNotEqual(text, ticket_set())
        self.assertEqual(problems(tickets_text=text), [])

    def test_wrapped_criterion_missing_evidence_still_fails(self):
        wrapped = ("- [ ] AC-2 [invariant] every WF-1 record carries run_id\n"
                   "  — verify: `uv run pytest tests/unit/test_quote.py`")
        text = ticket_set().replace(AC2_ONE_LINE, wrapped)
        assert_problem(self, problems(tickets_text=text),
                       "LAN-02 AC-2: needs 'verify:' and 'evidence:'")

    def test_new_item_and_blank_line_end_a_criterion(self):
        lines = m.join_continuations("- [ ] AC-1 a — verify: x\n  - [ ] AC-2 b\n\n"
                                     "  — evidence: y\nplain")
        self.assertEqual(lines, ["- [ ] AC-1 a — verify: x", "  - [ ] AC-2 b", "",
                                 "  — evidence: y", "plain"])


RANGE_REGISTRY = REGISTRY.replace(
    "| routing suite; M-1 |", "| routing suite; M-6 to M-9, M-14, M-16…M-18 |").replace(
    "| n/a — refresh has no expected answer to score |", "| M-3 to M-5 |")
RANGE_WORKFLOWS = m.parse_workflows([RANGE_REGISTRY])


class MetricRanges(unittest.TestCase):
    """'M-a to M-b' in the registry's Eval and metrics column means every metric from a to b."""

    def range_set(self, wf1_refs, wf2_refs="M-3, M-4, M-5"):
        return ticket_set(
            **{"LAN-02": ticket(
                "LAN-02", "quote", [("AC-1", "quote returns a route", "t", "e"),
                                    ("AC-2", "every WF-1 record carries run_id", "t", "e"),
                                    ("AC-3", "no customer name in WF-1 records", "t", "e")],
                blocked="LAN-01", entry="WF-1",
                metrics="- References: %s\n- Acceptance conditions: computable" % wf1_refs),
               "LAN-03": ticket(
                "LAN-03", "refresh", [("AC-1", "every WF-2 record carries run_id", "t", "e")],
                blocked="LAN-01", entry="WF-2",
                ev="N/A — the refresh has no expected answer; only capture is in scope here",
                metrics="- References: %s\n- Acceptance conditions: computable" % wf2_refs)})

    def test_ranges_expand_to_every_metric(self):
        self.assertEqual(m.metric_ids("M-6 to M-9, M-14, M-16 to M-26"),
                         {"M-%d" % n for n in [6, 7, 8, 9, 14] + list(range(16, 27))})
        self.assertEqual(m.metric_ids("M-1…M-3; M-5–M-6; M-8...M-9"),
                         {"M-1", "M-2", "M-3", "M-5", "M-6", "M-8", "M-9"})

    def test_ticket_referencing_every_metric_in_the_ranges_passes(self):
        found = problems(tickets_text=self.range_set("M-6, M-7, M-8, M-9, M-14, M-16, M-17, M-18"),
                         workflows=RANGE_WORKFLOWS)
        self.assertEqual(found, [])
        found = problems(tickets_text=self.range_set("M-6 to M-9, M-14, M-16–M-18", "M-3 to M-5"),
                         workflows=RANGE_WORKFLOWS)
        self.assertEqual(found, [])

    def test_metric_inside_a_range_must_be_referenced(self):
        found = problems(tickets_text=self.range_set("M-6, M-9, M-14, M-16, M-18"),
                         workflows=RANGE_WORKFLOWS)
        assert_problem(self, found, "Metrics does not reference M-17, M-7, M-8")
        self.assertFalse(any("M-6," in p.split("does not reference")[-1] for p in found), found)

    def test_metric_only_range_is_not_evaluation_inheritance(self):
        # WF-2's cell is only 'M-3 to M-5'; the leftover 'to' must not read as an evaluation.
        found = problems(tickets_text=self.range_set("M-6 to M-9, M-14, M-16 to M-18"),
                         workflows=RANGE_WORKFLOWS)
        self.assertFalse(any("inherits evaluation" in p for p in found), found)

    def test_plan_registration_expands_ranges(self):
        plan = GOOD_PLAN.replace("| nightly refresh | WF-2 | yes | n/a — no eval or metric |",
                                 "| nightly refresh | WF-2 | yes | M-3 to M-5 |")
        found, _ = m.check_plan(plan, RANGE_WORKFLOWS)
        self.assertEqual(found, [])
        plan = plan.replace("| M-3 to M-5 |", "| M-3, M-5 |")
        found, _ = m.check_plan(plan, RANGE_WORKFLOWS)
        assert_problem(self, found, "the plan omits M-4")


GOOD_PLAN = """# Plan — [LAN-03] refresh: wire adapter into nightly refresh

**Status:** planned

## Sources checked

| Source | Location | What it obliges here |
|---|---|---|
| Requirements | docs/requirements.md §5 | OBS-1 run_id on every record |
| Component contracts | docs/design.md#Contracts | C-2 adapter signature |
| Evaluation plan | n/a — the refresh has no expected answer to score | — |
| Observability contract | docs/design.md#Observability contract, WF-2 | refresh.finished with run_id; completeness check |
| Key-metrics registry | n/a — no metric reads refresh records this release | — |

## Source-contract reconciliation

| Obligation | Governing source | In ticket | Disposition | Plan step or owner |
|---|---|---|---|---|
| run_id on every WF-2 record | requirements OBS-1 | AC-1 | in-ticket | step 2 |
| missing-run completeness check for WF-2 | observability contract, Missing instrumentation | no | added | step 4; issue comment proposes AC-2 |

## Entry-point registration

| Entry point | Workflow | Registered in contract | Inherits |
|---|---|---|---|
| nightly refresh | WF-2 | yes | n/a — no eval or metric |
"""


class Plans(unittest.TestCase):
    def test_good_plan_passes(self):
        found, open_items = m.check_plan(GOOD_PLAN, WORKFLOWS)
        self.assertEqual(found, [])
        self.assertFalse(open_items)

    def test_plan_must_reconcile_not_just_copy_acceptance_criteria(self):
        # A plan that only restates the issue's criteria has no reconciliation section.
        before, rest = GOOD_PLAN.split("## Source-contract reconciliation")
        text = before + "## Entry-point registration" + rest.split("## Entry-point registration")[1]
        found, _ = m.check_plan(text, WORKFLOWS)
        assert_problem(self, found, "source-contract reconciliation table is missing")

    def test_every_governing_source_must_be_opened(self):
        text = GOOD_PLAN.replace(
            "| Observability contract | docs/design.md#Observability contract, WF-2 | refresh.finished with run_id; completeness check |\n", "")
        found, _ = m.check_plan(text, WORKFLOWS)
        assert_problem(self, found, "no 'observability contract' row")

    def test_new_entry_point_must_be_registered_first(self):
        text = GOOD_PLAN.replace("| nightly refresh | WF-2 | yes |",
                                 "| scripts/backfill.py | WF-7 | no |")
        found, _ = m.check_plan(text, WORKFLOWS)
        assert_problem(self, found, "WF-7 is not in the observability contract")
        assert_problem(self, found, "is not registered in the observability contract")

    def test_open_decision_must_set_status(self):
        text = GOOD_PLAN.replace("| no | added | step 4; issue comment proposes AC-2 |",
                                 "| no | needs-decision | whether a missed run pages anyone |")
        found, open_items = m.check_plan(text, WORKFLOWS)
        self.assertTrue(open_items)
        assert_problem(self, found, "needs-decision obligation but plan Status is 'planned'")
        found, _ = m.check_plan(text.replace("**Status:** planned", "**Status:** NEEDS-DECISION"),
                                WORKFLOWS)
        self.assertEqual(found, [])

    def test_template_is_reported_as_unfilled(self):
        with open(os.path.join(TEMPLATES, "implementation-plan.md"), encoding="utf-8") as f:
            found, _ = m.check_plan(f.read(), WORKFLOWS)
        assert_problem(self, found, "reconciliation lists no obligations")


class Cli(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="coverage-audit-test-")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def write(self, name, text):
        path = os.path.join(self.dir, name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return path

    def run_cli(self, *args):
        return subprocess.run([sys.executable, SCRIPT] + list(args), capture_output=True, text=True)

    def test_check_exit_codes_and_full_set_count(self):
        a, t, w = self.write("audit.md", audit()), self.write("t.md", ticket_set()), \
            self.write("obs.md", REGISTRY)
        ok = self.run_cli("check", a, "--tickets", t, "--workflows", w)
        self.assertEqual(ok.returncode, 0, ok.stdout)
        self.assertIn("tickets checked: 5 (the whole set)", ok.stdout)
        bad = self.run_cli("check", self.write("bad.md", audit(matrix="")), "--tickets", t,
                           "--workflows", w)
        self.assertEqual(bad.returncode, 1)
        self.assertIn("missing consumer integration", bad.stdout)

    def test_check_plan_and_missing_files(self):
        p, w = self.write("plan.md", GOOD_PLAN), self.write("obs.md", REGISTRY)
        self.assertEqual(self.run_cli("check-plan", p, "--workflows", w).returncode, 0)
        blocked = self.write("blocked.md", GOOD_PLAN.replace(
            "| no | added | step 4; issue comment proposes AC-2 |",
            "| no | needs-decision | whether a missed run pages anyone |").replace(
            "**Status:** planned", "**Status:** NEEDS-DECISION"))
        r = self.run_cli("check-plan", blocked, "--workflows", w)
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("not ready for execution", r.stdout)
        self.assertEqual(self.run_cli("check-plan", os.path.join(self.dir, "nope.md")).returncode, 2)


if __name__ == "__main__":
    unittest.main()
