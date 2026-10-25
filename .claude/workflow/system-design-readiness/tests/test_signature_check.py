"""Tests for scripts/signature_check.py: the section 6 signature-completeness check.

Stdlib only; run with `python3 -m unittest discover -s tests`. Every example is invented
("Lantern", a fictional quote service); no real project is read or changed.
"""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(SKILL_ROOT, "scripts", "signature_check.py")


def load_module():
    spec = importlib.util.spec_from_file_location("signature_check_under_test", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


m = load_module()

FENCE = "```"

DO3 = """# Code design (DO-3)

## Ports

| Port | Why it is an interface | Implementations |
|---|---|---|
| `QuoteStore` | storage may move to Postgres | `SqliteQuoteStore`, test fake |

## Services

| Module | Responsibility (one sentence) | Interface (DO-4) | Depends on |
|---|---|---|---|
| `services/quote.py` | Price one request. | `QuoteService.price` | `Clock`, `QuoteStore` |
| `services/mail.py` | Send the quote email. | `send` | `Mailer` |

## Build areas

| Wave | Area | Owns | Depends on |
|---|---|---|---|
| 0 | A0 | `adapters/sqlite/{db,repos_core}.py`, `schema/00_core.sql` | — |
| 1 | A1 | `services/quote.py`, `agent/nodes/{price,reply}.py` | A0 |
| 1 | A2 | `repos_audit.py` | A0 |
"""

DO4_COMPLETE = FENCE + """python
class QuoteStore(Protocol):
    def get(self, quote_id: QuoteId) -> Quote | None: ...

class SqliteQuoteStore:                               # adapters/sqlite/repos_core.py
    def __init__(self, path: str) -> None: ...
    def get(self, quote_id: QuoteId) -> Quote | None: ...

class Quote(BaseModel):
    quote_id: QuoteId; amount_cents: int
    status: QuoteStatus

class QuoteStatus(StrEnum):
    OPEN = "open"; SENT = "sent"

class QuoteService:
    def __init__(self, store: QuoteStore) -> None: ...
    def price(self, req: PriceRequest,
              now: datetime) -> Priced | Refused: ...

class MailService:
    def send(self, quote: Quote) -> "Sent": ...

class Priced(BaseModel):
    quote: Quote
class Refused(BaseModel):
    code: Literal["out_of_area", "too_big"]
class Sent(BaseModel):
    message_id: str

class Db:                                             # adapters/sqlite/db.py
    def connect(self) -> Connection: ...
Connection = sqlite3.Connection
class AuditRepos:
    def append(self, row: AuditRow) -> int: ...
class AuditRow(BaseModel):
    at: datetime

def price(state: QuoteState) -> dict[str, int]: ...
def reply_node(state: QuoteState) -> Reply: ...
class Reply(BaseModel):
    text: str

class ApiErrorCode(StrEnum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    QUOTE_NOT_FOUND = "QUOTE_NOT_FOUND"
""" + FENCE + """

| Type | Shape |
|---|---|
| `QuoteId` | `Q-\\d{4}` |
"""

DO6 = """# Observability contract

| Workflow | Entry point | Class | Emitting components | Correlation | Required records | Capture verification | Eval and metrics |
|---|---|---|---|---|---|---|---|
| WF-1 | `POST /quotes` | user-operation | API | request_id | quote, audit_row (who and when); every WF-2 record tagged `eval` | CAP-1 | M-1 |
| WF-2 | nightly job | background-job | job | run_id | job_run, `var/runs/*.json` run records | CAP-2 | n/a — nothing scored here at all |
"""

DO3_STORAGE_EXTRA = """
The `quotes` table and `audit_rows` table live in `schema/00_core.sql`; `job_runs` too.
"""

OPENAPI = """openapi: 3.1.0
components:
  schemas:
    ApiError:
      type: object
      properties:
        error:
          type: object
          properties:
            code:
              type: string
              enum:
                - VALIDATION_ERROR
                - QUOTE_NOT_FOUND
            field:
              type: string
    Quote:
      type: object
      properties:
        code:
          type: string
          enum:
            - NOT_AN_ERROR_ENUM
"""


def run_all(do3=DO3 + DO3_STORAGE_EXTRA, do4=DO4_COMPLETE, do6=DO6, openapi=OPENAPI):
    return m.run(do3, [do4], do6, openapi)


class CleanDesign(unittest.TestCase):
    def test_complete_design_has_no_findings(self):
        self.assertEqual(run_all(), {k: [] for k in m.KINDS})


class Signatures(unittest.TestCase):
    def test_port_and_implementation_need_classes_with_methods(self):
        do4 = DO4_COMPLETE.replace("class SqliteQuoteStore:", "class OtherStore:")
        found = run_all(do4=do4)["signature"]
        self.assertTrue(any("SqliteQuoteStore" in f and "no class" in f for f in found), found)

    def test_class_without_methods_is_reported(self):
        do4 = DO4_COMPLETE.replace(
            "class QuoteService:\n    def __init__(self, store: QuoteStore) -> None: ...\n"
            "    def price(self, req: PriceRequest,\n              now: datetime) -> Priced | Refused: ...",
            "class QuoteService(BaseModel):\n    store: str")
        found = run_all(do4=do4)["signature"]
        self.assertTrue(any("QuoteService" in f and "no method" in f for f in found), found)

    def test_dependency_column_names_are_not_components(self):
        found = run_all()["signature"]
        self.assertFalse(any("Clock" in f or "Mailer" in f for f in found), found)

    def test_unnamed_service_module_uses_derived_name(self):
        do4 = DO4_COMPLETE.replace("class MailService:", "class Postman:")
        found = run_all(do4=do4)["signature"]
        self.assertTrue(any("services/mail.py" in f and "MailService" in f for f in found), found)

    def test_build_area_paths_resolve_and_match_path_comment(self):
        do4 = DO4_COMPLETE.replace("# adapters/sqlite/db.py", "")
        found = run_all(do4=do4)["signature"]
        self.assertEqual(found, ["adapter module adapters/sqlite/db.py (DO-3 build areas line 20):"
                                 " names no class, and DO-4 has none with methods (looked for "
                                 "DbAdapter / DbRepos / DbRepo or a class whose definition line "
                                 "cites the path)"])

    def test_bare_repo_file_resolves_to_its_directory(self):
        do4 = DO4_COMPLETE.replace("class AuditRepos:", "class Ledger:")
        found = run_all(do4=do4)["signature"]
        self.assertTrue(any("adapters/sqlite/repos_audit.py" in f for f in found), found)

    def test_node_needs_a_def(self):
        do4 = DO4_COMPLETE.replace("def reply_node(", "def answer(")
        found = run_all(do4=do4)["signature"]
        self.assertTrue(any("agent/nodes/reply.py" in f for f in found), found)


class ReturnTypes(unittest.TestCase):
    def test_undefined_return_type(self):
        do4 = DO4_COMPLETE.replace("class Priced(BaseModel):\n    quote: Quote\n", "")
        found = run_all(do4=do4)["return-type"]
        self.assertEqual(len(found), 1, found)
        self.assertIn("QuoteService.price", found[0])
        self.assertIn("Priced is never defined", found[0])

    def test_multiline_signature_and_forward_ref_parse(self):
        model = m.parse_contracts(DO4_COMPLETE)
        rets = {(o, n): r for o, n, r, _ in model["signatures"]}
        self.assertEqual(rets[("QuoteService", "price")], "Priced | Refused")
        self.assertEqual(rets[("MailService", "send")], '"Sent"')

    def test_bare_dict_and_missing_return(self):
        do4 = DO4_COMPLETE.replace("def connect(self) -> Connection: ...",
                                   "def connect(self) -> dict: ...\n    def close(self): ...")
        found = run_all(do4=do4)["return-type"]
        self.assertTrue(any("Db.connect -> dict" in f and "bare" in f for f in found), found)
        self.assertTrue(any("Db.close: no return type" in f for f in found), found)

    def test_literal_contents_and_typing_names_ignored(self):
        self.assertEqual(m._return_names('Literal["Off", "On"] | ContextManager[Span] | None'),
                         ["Span"])

    def test_aliases_ids_and_enums_count_as_defined(self):
        model = m.parse_contracts(DO4_COMPLETE)
        for name in ("Connection", "QuoteId", "QuoteStatus", "Quote"):
            self.assertTrue(m._defined(model, name), name)
        self.assertFalse(m._defined(model, "PriceRequest"))


class ErrorCodes(unittest.TestCase):
    def test_missing_code_reported_and_other_enums_ignored(self):
        openapi = OPENAPI.replace("- QUOTE_NOT_FOUND", "- QUOTE_NOT_FOUND\n                - LOGIN_FAILED")
        found = run_all(openapi=openapi)["error-code"]
        self.assertEqual(len(found), 1, found)
        self.assertTrue(found[0].startswith("LOGIN_FAILED (ApiError line"), found)

    def test_x_error_and_inline_enum(self):
        openapi = OPENAPI + "paths:\n  /q:\n    get:\n      x-errors: [QUOTE_NOT_FOUND, GONE]\n"
        codes = m.openapi_error_codes(openapi)
        self.assertIn("GONE", codes)
        self.assertNotIn("NOT_AN_ERROR_ENUM", codes)
        self.assertEqual(run_all(openapi=openapi)["error-code"][0].split(" ")[0], "GONE")

    def test_no_error_enum_in_do4(self):
        do4 = DO4_COMPLETE.replace("class ApiErrorCode(StrEnum):", "class ApiCodes(StrEnum):")
        found = run_all(do4=do4)["error-code"]
        self.assertEqual(found, ["DO-4 has no *ErrorCode enum to map the OpenAPI error codes to"])

    def test_openapi_optional(self):
        self.assertEqual(m.run(DO3 + DO3_STORAGE_EXTRA, [DO4_COMPLETE], DO6)["error-code"], [])


class Records(unittest.TestCase):
    def test_record_names_parse(self):
        self.assertEqual(
            m._record_names("request, case_event (actor, reason), promise status change; "
                            "case and promise when handed off, every WF-1 record tagged `eval`, "
                            "`var/x/*.json` run records"),
            ["request", "case_event", "promise_status_change", "case", "promise"])

    def test_record_without_storage_reported(self):
        found = run_all(do3=DO3)["record"]
        self.assertTrue(any(f.startswith("quote (required by WF-1)") for f in found), found)
        self.assertTrue(any(f.startswith("job_run (required by WF-2)") for f in found), found)

    def test_plural_table_names_match(self):
        self.assertEqual(run_all()["record"], [])


def ret_findings(extra, openapi=OPENAPI, allow=()):
    """Return-type findings for DO4_COMPLETE plus one extra code block."""
    do4 = DO4_COMPLETE + "\n" + FENCE + "python\n" + extra + "\n" + FENCE + "\n"
    return m.run(DO3 + DO3_STORAGE_EXTRA, [do4], DO6, openapi, allow)["return-type"]


OPENAPI_SCHEMAS = OPENAPI + """    QueueResponse:
      type: object
      properties:
        rows: {type: array}
    Staffing:
      type: object
"""


class ReturnTypesNotGaps(unittest.TestCase):
    def test_openapi_component_schema_counts_as_defined(self):
        self.assertEqual(ret_findings("def show() -> QueueResponse: ...", OPENAPI_SCHEMAS), [])
        found = ret_findings("def show() -> QueueResponse: ...", OPENAPI)
        self.assertTrue(any("QueueResponse is never defined" in f for f in found), found)

    def test_openapi_schemas_are_listed(self):
        names = m.openapi_schemas(OPENAPI_SCHEMAS)
        self.assertEqual(names, {"ApiError", "Quote", "QueueResponse", "Staffing"})

    def test_prose_and_comment_mappings_to_openapi(self):
        extra = ("def queue() -> QueueView: ...\n"
                 "def staffing() -> StaffingView: ...      # = OpenAPI Staffing\n"
                 "def info() -> InfoData: ...\n"
                 "# InfoData: the OpenAPI Staffing fields\n")
        do4_prose = "\nTypes by name: `QueueView` = `QueueResponse`.\n"
        do4 = DO4_COMPLETE + do4_prose + FENCE + "python\n" + extra + FENCE + "\n"
        found = m.run(DO3 + DO3_STORAGE_EXTRA, [do4], DO6, OPENAPI_SCHEMAS)["return-type"]
        self.assertEqual(found, [])

    def test_mapping_to_a_missing_schema_is_still_a_gap(self):
        extra = "def staffing() -> StaffingView: ...      # = OpenAPI NoSuchSchema\n"
        do4 = (DO4_COMPLETE + "\n`QueueView` = `NoSuchThing`.\n" + FENCE + "python\n"
               + extra + "def queue() -> QueueView: ...\n" + FENCE + "\n")
        found = m.run(DO3 + DO3_STORAGE_EXTRA, [do4], DO6, OPENAPI_SCHEMAS)["return-type"]
        self.assertEqual(len(found), 2, found)

    def test_alias_forms_count_as_defined(self):
        extra = ("UserId = NewType(\"UserId\", str)\n"
                 "NodeFn = Callable[[State], dict[str, int]]\n"
                 "Presence = Literal[\"nobody\",\n                   \"on_shift\"]\n"
                 "type Span = tuple[int, int]\n"
                 "@dataclass(frozen=True)\nclass Window:\n    start: int\n"
                 "class Pair(NamedTuple):\n    a: int\n"
                 "class Row(TypedDict):\n    id: int\n"
                 "class Colour(Enum):\n    RED = 1\n"
                 "def a() -> UserId: ...\ndef b() -> NodeFn: ...\ndef c() -> Presence: ...\n"
                 "def d() -> Span: ...\ndef e() -> Window | Pair | Row | Colour: ...")
        self.assertEqual(ret_findings(extra), [])

    def test_prose_literal_alias(self):
        do4 = DO4_COMPLETE + '\n`Mode` = `Literal["a", "b"]`\n' + FENCE + "python\ndef f() -> Mode: ...\n" + FENCE
        self.assertEqual(m.run(DO3 + DO3_STORAGE_EXTRA, [do4], DO6, OPENAPI)["return-type"], [])

    def test_imported_qualified_and_allowed_external_types(self):
        extra = ("from langgraph.types import Send\nfrom foo import (Bar,\n    Baz as Qux)\n"
                 "def a() -> list[Send]: ...\ndef b() -> anyio.CapacityLimiter: ...\n"
                 "def c() -> Bar: ...\ndef d() -> Command: ...")
        found = ret_findings(extra)
        self.assertEqual(found, [], found)  # Send imported, anyio qualified, Bar imported, Command allowed

    def test_allow_type_extends_the_list(self):
        found = ret_findings("def a() -> Limiter: ...")
        self.assertEqual(len(found), 1, found)
        self.assertEqual(ret_findings("def a() -> Limiter: ...", allow=["Limiter"]), [])

    def test_documented_marker_class_is_defined_bare_one_is_not(self):
        ok = "class Missing(BaseModel): ...      # no fields: no cookie\ndef a() -> Missing: ..."
        self.assertEqual(ret_findings(ok), [])
        bare = "class Missing(BaseModel): ...\ndef a() -> Missing: ..."
        self.assertEqual(len(ret_findings(bare)), 1)

    def test_real_gaps_still_flagged(self):
        found = ret_findings("def a() -> VisitView | None: ...\ndef b() -> Any: ...\n"
                             "def adapter_for(provider, spec): …\ndef g(x): return 1")
        self.assertTrue(any("VisitView is never defined" in f for f in found), found)
        self.assertTrue(any(f.startswith("b -> Any: a bare Any") for f in found), found)
        self.assertTrue(any(f == "adapter_for: no return type" for f in found), found)
        self.assertTrue(any(f == "g: no return type" for f in found), found)
        self.assertEqual(len(found), 4, found)

    def test_one_line_body_keeps_its_annotation(self):
        model = m.parse_contracts(FENCE + "python\ndef fee(h: float) -> bool: return h < 24.0\n" + FENCE)
        self.assertEqual(model["signatures"][0][2], "bool")


class ModulesPlacedByDo4(unittest.TestCase):
    """adapters/sqlite/db.py has no derived class once Db's path comment is removed."""
    BASE = DO4_COMPLETE.replace("# adapters/sqlite/db.py", "")

    def found(self, extra):
        do4 = self.BASE + extra
        return [f for f in m.run(DO3 + DO3_STORAGE_EXTRA, [do4], DO6, OPENAPI)["signature"]
                if "db.py" in f]

    def test_heading_naming_the_module(self):
        extra = "\n## 3. `adapters/sqlite/db.py` (A0)\n\n" + FENCE + "python\ndef open_db(p: str) -> Connection: ...\n" + FENCE + "\n"
        self.assertEqual(self.found(extra), [])

    def test_top_level_comment_scope_and_dotted_signature(self):
        extra = "\n" + FENCE + "python\n# adapters/sqlite/db.py (A0)\ncore.db.open(path: str) -> Connection\n" + FENCE + "\n"
        self.assertEqual(self.found(extra), [])

    def test_signature_comment_and_comment_link(self):
        own = "\n" + FENCE + "python\ndef open_db(p: str) -> Connection: ...   # adapters/sqlite/db.py\n" + FENCE
        self.assertEqual(self.found(own), [])
        link = ("\n" + FENCE + "python\ndef open_db(p: str) -> Connection: ...\n" + FENCE + "\n"
                + FENCE + "python\n# open_db (sqlite/db.py, A0): opens the file\n" + FENCE + "\n")
        self.assertEqual(self.found(link), [])

    def test_mention_without_an_annotated_signature_is_still_a_gap(self):
        extra = ("\n## 3. `adapters/sqlite/db.py` (A0)\n\nUTC written by `adapters/sqlite/db.py`.\n\n"
                 + FENCE + "python\n# adapters/sqlite/db.py\nPATH = 'x'\nclass Row(BaseModel):\n"
                 "    id: int\ndef open_db(p): ...\n# open_db (adapters/sqlite/db.py)\n" + FENCE + "\n")
        self.assertEqual(len(self.found(extra)), 1)

    def test_class_implementing_a_protocol_borrows_its_methods(self):
        do4 = DO4_COMPLETE.replace(
            "class SqliteQuoteStore:                               # adapters/sqlite/repos_core.py\n"
            "    def __init__(self, path: str) -> None: ...\n"
            "    def get(self, quote_id: QuoteId) -> Quote | None: ...",
            "class SqliteQuoteStore:      # implements QuoteStore\n    path: str")
        found = run_all(do4=do4)["signature"]
        self.assertFalse(any("SqliteQuoteStore" in f for f in found), found)
        do4 = do4.replace("# implements QuoteStore", "# a store")
        found = run_all(do4=do4)["signature"]
        self.assertTrue(any("SqliteQuoteStore" in f and "no method" in f for f in found), found)


class ErrorCodesDeclaredElsewhere(unittest.TestCase):
    OPENAPI_LOGIN = OPENAPI.replace("- QUOTE_NOT_FOUND", "- QUOTE_NOT_FOUND\n                - LOGIN_FAILED\n"
                                    "                - UNAUTHENTICATED")

    def codes(self, extra_do4):
        return run_all(do4=DO4_COMPLETE + extra_do4, openapi=self.OPENAPI_LOGIN)["error-code"]

    def test_literal_union_alias(self):
        extra = "\n" + FENCE + 'python\nLoginCode = Literal["LOGIN_FAILED",\n    "UNAUTHENTICATED"]\n' + FENCE
        self.assertEqual(self.codes(extra), [])

    def test_code_class_members(self):
        extra = "\n" + FENCE + 'python\nclass AuthCode(StrEnum):\n    LOGIN_FAILED = "LOGIN_FAILED"; UNAUTHENTICATED = "UNAUTHENTICATED"\n' + FENCE
        self.assertEqual(self.codes(extra), [])

    def test_table_under_an_error_heading(self):
        extra = ("\n## 4. Login errors\n\n| Code | Status |\n|---|---|\n| `LOGIN_FAILED` | 401 |\n"
                 "| `UNAUTHENTICATED` | 401 |\n")
        self.assertEqual(self.codes(extra), [])
        other = extra.replace("Login errors", "Login answers")
        self.assertEqual(len(self.codes(other)), 2)

    def test_paragraph_adds_and_drops(self):
        # the real shape (AEA web.md section 1)
        extra = ("\n## 1. Errors on the wire\n\n`ApiErrorCode`'s HTTP part is exactly the OpenAPI enum: it "
                 "**adds** `LOGIN_FAILED`,\n`UNAUTHENTICATED` and **drops** `QUOTE_GONE` (still listed).\n")
        self.assertEqual(self.codes(extra), [])
        self.assertNotIn("QUOTE_GONE", m._error_section_codes(extra))
        no_type = extra.replace("`ApiErrorCode`'s", "The")
        self.assertEqual(len(self.codes(no_type)), 2)


class RecordsNotProse(unittest.TestCase):
    def test_note_and_later_sentences_are_not_records(self):
        cell = ("request; auth_event (outcome `ok`, time). **Note (Stage 7, MC-9; WEB-11):** `auth_event` "
                "carries the opaque demo session id, never the cookie token")
        self.assertEqual(m._record_names(cell), ["request", "auth_event"])
        self.assertEqual(m._record_names("job_run, index record. Later the index carries a hash"),
                         ["job_run", "index_record"])

    def test_head_noun_matches_a_named_file(self):
        do6 = DO6.replace("job_run, `var/runs/*.json` run records", "job_run, ingestion manifest")
        extra = "\n| `manifest.json` | 17 rows |\n"
        self.assertEqual(m.run(DO3 + DO3_STORAGE_EXTRA + extra, [DO4_COMPLETE], do6)["record"], [])
        found = m.run(DO3 + DO3_STORAGE_EXTRA, [DO4_COMPLETE], do6)["record"]
        self.assertTrue(any(f.startswith("ingestion_manifest") for f in found), found)

    def test_record_with_no_storage_still_flagged(self):
        do6 = DO6.replace("job_run, `var/runs/*.json` run records", "job_run, client-side turn timings")
        found = m.run(DO3 + DO3_STORAGE_EXTRA, [DO4_COMPLETE], do6)["record"]
        self.assertTrue(any(f.startswith("client_side_turn_timings") for f in found), found)


class Cli(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.paths = {}
        for name, text in (("do3.md", DO3 + DO3_STORAGE_EXTRA), ("do4.md", DO4_COMPLETE),
                           ("do6.md", DO6), ("api.yaml", OPENAPI),
                           ("bad4.md", DO4_COMPLETE.replace("class Sent(BaseModel):", "class X:"))):
            path = os.path.join(self.dir, name)
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
            self.paths[name] = path

    def tearDown(self):
        import shutil
        shutil.rmtree(self.dir, ignore_errors=True)

    def cli(self, do4="do4.md", *extra):
        args = [sys.executable, SCRIPT, "--code-design", self.paths["do3.md"],
                "--contracts", self.paths[do4], "--observability", self.paths["do6.md"],
                "--openapi", self.paths["api.yaml"]] + list(extra)
        return subprocess.run(args, capture_output=True, text=True)

    def test_clean_exits_zero(self):
        r = self.cli()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertTrue(r.stdout.strip().splitlines()[-1].startswith("result:"))

    def test_findings_exit_one_one_line_each(self):
        r = self.cli("bad4.md")
        self.assertEqual(r.returncode, 1)
        lines = r.stdout.strip().splitlines()
        self.assertTrue(lines[-1].startswith("result: 1 finding(s)"), lines)
        self.assertTrue(lines[0].startswith("return-type: MailService.send"), lines)

    def test_json(self):
        r = self.cli("bad4.md", "--json")
        self.assertEqual(r.returncode, 1)
        data = json.loads(r.stdout)
        self.assertEqual(data["total"], 1)
        self.assertEqual(set(data["findings"]), set(m.KINDS))

    def test_allow_type_flag_repeats(self):
        bad = DO4_COMPLETE.replace("class Sent(BaseModel):\n    message_id: str", "")
        path = os.path.join(self.dir, "bad5.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(bad)
        self.paths["bad5.md"] = path
        self.assertEqual(self.cli("bad5.md").returncode, 1)
        r = self.cli("bad5.md", "--allow-type", "Other", "--allow-type", "Sent")
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_missing_file_exits_two(self):
        r = subprocess.run([sys.executable, SCRIPT, "--code-design", "/nonexistent.md",
                            "--contracts", self.paths["do4.md"],
                            "--observability", self.paths["do6.md"]],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)


if __name__ == "__main__":
    unittest.main()
