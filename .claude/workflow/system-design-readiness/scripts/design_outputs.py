"""Required design outputs: register gates and minimum-content checks.

Read-only and stdlib only. The contract is DESIGN-OUTPUTS.md beside this skill.

CLI:
    design_outputs.py skeleton [--spec PATH]
        Print an empty register: one row per required output (DO-n).
    design_outputs.py check DOC [--gate interview|readiness|tickets] [--spec PATH] [--root DIR]
        Check the register in DOC. Without --gate, structure only. With a gate, the rules for
        that gate (DESIGN-OUTPUTS.md -> Four gates). The tickets gate also opens DO-5, DO-6 and
        DO-7 at their Locations (relative to --root, default the repository holding DOC) and
        checks their minimum contents.
    design_outputs.py check-eval PATH[#Heading]
    design_outputs.py check-obs PATH[#Heading]
    design_outputs.py check-metrics PATH[#Heading]
        Check one output's minimum contents directly.

Exit codes: 0 no problems, 1 problems found, 2 usage or file error.
What these checks cannot judge (truth of N/A reasons, completeness of the workflow registry,
whether a formula measures its purpose) is listed in DESIGN-OUTPUTS.md and stays with a reviewer.
"""
import argparse
import os
import re
import sys

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
DEFAULT_SPEC = os.path.join(SKILL_ROOT, "DESIGN-OUTPUTS.md")

STATUSES = ("planned", "draft", "ready", "n/a")
GATES = ("interview", "readiness", "tickets")
WORKFLOW_CLASSES = (
    "user-operation", "background-job", "validation",
    "development-experiment", "runtime-operation",
)
METRIC_KINDS = (
    "operational", "correctness", "coverage", "validation",
    "safe-refusal", "cost", "outcome",
)

EVAL_SECTIONS = (
    "expected-answer authority",
    "case provenance",
    "development and held-out separation",
    "scoring",
    "failure categories",
    "baselines",
    "acceptance conditions",
    "verification and evidence",
)
EVAL_NA_ALLOWED = {"development and held-out separation"}

OBS_SECTIONS = (
    "covered workflows",
    "correlation across boundaries",
    "storage and access",
    "content and redaction",
    "missing instrumentation",
    "capture verification",
    "registering a new workflow",
)

WORKFLOW_COLUMNS = (
    ("id", "workflow"), ("entry", "entry point"), ("class", "class"),
    ("emitters", "emitting"), ("correlation", "correlation"),
    ("records", "required records"), ("capture", "capture verification"),
    ("inherits", "eval"),
)
METRIC_COLUMNS = (
    ("id", "metric"), ("name", "name"), ("kind", "kind"), ("purpose", "purpose"),
    ("formula", "formula"), ("population", "population"), ("unit", "unit"),
    ("source", "source"), ("owner", "owner"), ("decision", "decision"),
    ("baseline", "baseline"), ("target", "target"),
)

_DO_ROW = re.compile(r"^\|\s*(DO-\d+)\s*\|")
_WF_ID = re.compile(r"\bWF-\d+\b")
_M_ID = re.compile(r"^M-\d+$")
_SD_REF = re.compile(r"\bSD-\d+\.\d+\b")
_HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
_COMMENT = re.compile(r"<!--.*?-->", re.S)
_PLACEHOLDER = re.compile(r"<[^<>\n]*>")
_BLOCK_PLACEHOLDER = re.compile(r"<[^<>|]*>")
_SEPARATOR = re.compile(r"^\|?\s*:?-{2,}")
_EMPTY = {"", "-", "—", "–", "tbd", "todo", "?", "none", "na", "n/a", "not applicable",
          "nothing", "null", "pending", "unknown"}
_NA_PREFIX = re.compile(r"^(n/a|na|not applicable)(?=$|[\s—–:.(,-])")
_FENCE = re.compile(r"^\s*(```|~~~)")
_APPROVED = re.compile(r"(?<!not )\bapproved\s+(?:by\s+|in\s+)?[A-Za-z]*-?\d+")
MIN_SECTION_WORDS = 3


# --------------------------------------------------------------------------- helpers

def _cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _plain(value):
    return value.replace("`", "").replace("*", "").strip().lower()


def strip_fences(text):
    """Blank out fenced code blocks (keeping line numbers): examples are not content."""
    out, inside = [], False
    for line in text.splitlines():
        if _FENCE.match(line):
            inside = not inside
            out.append("")
            continue
        out.append("" if inside else line)
    return "\n".join(out)


def effectively_empty(value):
    """True for blanks, placeholders and non-answers such as none, n/a, tbd or 'not applicable'."""
    return _plain(_PLACEHOLDER.sub("", value)).strip(" .") in _EMPTY


def _filled(value):
    """True when a cell or body says something beyond a placeholder or a non-answer."""
    return not effectively_empty(value)


def _na_reason(value):
    """For 'n/a — reason' (or 'NA', 'not applicable') return the reason ('' if none); None if
    the text is not an N/A. Placeholders never count as a reason."""
    text = _plain(_PLACEHOLDER.sub("", value))
    m = _NA_PREFIX.match(text)
    if not m:
        return None
    return text[m.end():].strip(" —–-:.()")


def _reason_ok(reason):
    return bool(reason) and len(reason.split()) >= 3


def _norm_heading(text):
    text = _plain(text)
    text = re.sub(r"^\d+[.)]?\s*", "", text)
    return text.rstrip(" :.")


def _tables(text):
    """Yield (header_cells_plain, [(line_no, cells)]) for every Markdown table outside code fences."""
    lines = strip_fences(text).splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
        if line.startswith("|") and _SEPARATOR.match(nxt):
            header = [_plain(c) for c in _cells(line)]
            rows = []
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append((i + 1, _cells(lines[i])))
                i += 1
            yield header, rows
            continue
        i += 1


def _columns(header, wanted):
    """Map logical names to column indexes by header prefix; return (map, missing names)."""
    found, missing = {}, []
    for key, prefix in wanted:
        idx = next((n for n, h in enumerate(header) if h.startswith(prefix)), None)
        if idx is None:
            missing.append(prefix)
        else:
            found[key] = idx
    return found, missing


def sections(text):
    """Return [(level, normalized heading, body text)] for every heading in text."""
    text = strip_fences(_COMMENT.sub("", text))
    lines = text.splitlines()
    heads = []
    for n, line in enumerate(lines):
        m = _HEADING.match(line)
        if m:
            heads.append((n, len(m.group(1)), _norm_heading(m.group(2))))
    out = []
    for k, (n, level, name) in enumerate(heads):
        end = len(lines)
        for n2, level2, _ in heads[k + 1:]:
            if level2 <= level:
                end = n2
                break
        out.append((level, name, "\n".join(lines[n + 1:end])))
    return out


def body_content(body):
    """Body text with comments, placeholders, table headers, separators and empty rows removed."""
    body = _COMMENT.sub("", body)
    while True:  # nested placeholders: strip innermost first
        stripped = _BLOCK_PLACEHOLDER.sub("", body)
        if stripped == body:
            break
        body = stripped
    lines = body.splitlines()
    kept = []
    for i, line in enumerate(lines):
        s = line.strip()
        if not s or _SEPARATOR.match(s) or _HEADING.match(s):
            continue
        if s.startswith("|"):
            nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
            if _SEPARATOR.match(nxt):
                continue  # header row
            if not any(_filled(c) for c in _cells(s)):
                continue
        if s.startswith(">"):
            continue  # owner/status banner
        cleaned = _PLACEHOLDER.sub("", s).strip()
        if _plain(cleaned).strip(" .") in _EMPTY:
            continue
        kept.append(cleaned)
    return "\n".join(kept)


def _find_section(text, key):
    for _, name, body in sections(text):
        if name.startswith(key):
            return body
    return None


def extract(text, anchor):
    """Return the text of the section whose heading starts with anchor, or None."""
    if not anchor:
        return text
    lines = strip_fences(_COMMENT.sub("", text)).splitlines()
    want = _norm_heading(anchor)
    for n, line in enumerate(lines):
        m = _HEADING.match(line)
        if m and _norm_heading(m.group(2)).startswith(want):
            level = len(m.group(1))
            end = len(lines)
            for n2 in range(n + 1, len(lines)):
                m2 = _HEADING.match(lines[n2])
                if m2 and len(m2.group(1)) <= level:
                    end = n2
                    break
            return "\n".join(lines[n:end])
    return None


def _required_sections(text, required, label, na_allowed=()):
    problems = []
    for key in required:
        body = _find_section(text, key)
        if body is None:
            problems.append("%s: missing section '%s'" % (label, key))
            continue
        content = body_content(body)
        if not content:
            bare = _na_reason(_COMMENT.sub("", body).strip()) is not None
            if bare and key in na_allowed:
                problems.append("%s: section '%s' is N/A without a reason" % (label, key))
            elif bare:
                problems.append("%s: section '%s' cannot be N/A; give a light answer instead"
                                % (label, key))
            else:
                problems.append("%s: section '%s' is empty or still a placeholder" % (label, key))
            continue
        reason = _na_reason(content)
        if reason is not None:
            if key not in na_allowed:
                problems.append("%s: section '%s' cannot be N/A; give a light answer instead"
                                % (label, key))
            elif not _reason_ok(reason):
                problems.append("%s: section '%s' is N/A without a reason" % (label, key))
        elif len(re.findall(r"\w+", content)) < MIN_SECTION_WORDS:
            problems.append("%s: section '%s' says too little to act on (%r)"
                            % (label, key, content[:40]))
    return problems


# --------------------------------------------------------------------------- spec and register

def load_outputs(path):
    """Return [{id, name}] from the first table of DO rows in DESIGN-OUTPUTS.md."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    for header, rows in _tables(text):
        outs = [{"id": c[0], "name": c[1]} for _, c in rows
                if c and _DO_ROW.match("| %s |" % c[0]) and len(c) > 1]
        if outs:
            return outs
    return []


def skeleton(outputs):
    rows = ["| ID | Output | Owner | Location | Sources | Status | Notes |",
            "|---|---|---|---|---|---|---|"]
    for o in outputs:
        rows.append("| %s | %s | | | | planned | — |" % (o["id"], o["name"]))
    return "\n".join(rows) + "\n"


def parse_register(text):
    """Return (rows, found_header) for the register table (header: ID | Output | ... | Status)."""
    for header, rows in _tables(_COMMENT.sub("", text)):
        if not header or header[0] != "id" or "output" not in header or "status" not in header:
            continue
        cols, _ = _columns(header, (
            ("id", "id"), ("output", "output"), ("owner", "owner"), ("location", "location"),
            ("sources", "source"), ("status", "status"), ("notes", "note")))
        out = []
        for n, cells in rows:
            if not _DO_ROW.match("| %s |" % cells[0]):
                continue
            row = {"line": n, "width_ok": len(cells) == len(header)}
            for key, idx in cols.items():
                row[key] = cells[idx] if idx < len(cells) else ""
            out.append(row)
        return out, True
    return [], False


def check_register(text, outputs, gate=None, root=None):
    """Return problems for the register in text at the given gate (None = structure only)."""
    if gate not in (None,) + GATES:
        raise ValueError("unknown gate %r" % gate)
    rows, found = parse_register(text)
    if not found:
        return ["Design outputs register is missing (table: ID | Output | Owner | Location | "
                "Sources | Status | Notes; see DESIGN-OUTPUTS.md)"]
    problems = []
    known = {o["id"]: o for o in outputs}
    seen = {}
    for row in rows:
        rid = row["id"]
        seen[rid] = seen.get(rid, 0) + 1
        where = "%s (line %d)" % (rid, row["line"])
        if not row["width_ok"]:
            problems.append("%s: cell count differs from the header (a '|' inside a cell?)" % where)
            continue
        if rid not in known:
            problems.append("%s: not a required output in DESIGN-OUTPUTS.md" % where)
        status = _plain(row.get("status", ""))
        if status not in STATUSES:
            problems.append("%s: status %r is not one of %s" % (where, status, ", ".join(STATUSES)))
            continue
        if status == "n/a":
            if not _reason_ok(_plain(_PLACEHOLDER.sub("", row.get("notes", ""))).strip(" —–-:.")):
                problems.append("%s: n/a needs a reason in Notes a reviewer could disagree with"
                                % where)
            if gate is not None and (not _filled(row.get("owner", ""))):
                problems.append("%s: n/a needs an Owner, the person who accepted it" % where)
            continue
        if gate is None:
            continue
        for field in ("owner", "location"):
            value = row.get(field, "")
            if not _filled(value) or "unknown" in _plain(value):
                problems.append("%s: no %s (required at the %s gate)" % (where, field, gate))
        if not _filled(row.get("sources", "")):
            problems.append("%s: no source references" % where)
        elif gate in ("readiness", "tickets") and not _SD_REF.search(row.get("sources", "")):
            problems.append("%s: Sources cite no readiness item (SD-x.y)" % where)
        if gate == "tickets" and status != "ready":
            problems.append("%s: status %s; tickets need every output ready or n/a"
                            % (where, status))
    for o in outputs:
        if o["id"] not in seen:
            problems.append("%s (%s): missing from the design outputs register"
                            % (o["id"], o["name"]))
    for rid, count in sorted(seen.items()):
        if count > 1:
            problems.append("%s: appears %d times in the register" % (rid, count))

    if gate == "tickets" and root is not None:
        content_checks = {"DO-5": check_evaluation_plan, "DO-6": check_observability_contract,
                          "DO-7": check_metrics_registry}
        for row in rows:
            fn = content_checks.get(row["id"])
            if fn is None or _plain(row.get("status", "")) != "ready":
                continue
            target, err = load_location(row.get("location", ""), root)
            if err:
                problems.append("%s: %s" % (row["id"], err))
            else:
                problems.extend("%s: %s" % (row["id"], p) for p in fn(target))
    return problems


def load_location(location, root):
    """Return (text, error) for 'path' or 'path#Heading' relative to root."""
    loc = location.replace("`", "").strip()
    path, _, anchor = loc.partition("#")
    full = path if os.path.isabs(path) else os.path.join(root, path)
    try:
        with open(full.strip(), encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return None, "location %s cannot be read under %s" % (path.strip(), root)
    if anchor:
        part = extract(text, anchor)
        if part is None:
            return None, "no heading '%s' in %s" % (anchor.strip(), path.strip())
        return part, None
    return text, None


# --------------------------------------------------------------------------- content checks

def check_evaluation_plan(text):
    problems = _required_sections(text, EVAL_SECTIONS, "evaluation plan", EVAL_NA_ALLOWED)
    body = _find_section(text, "baselines")
    if body is not None:
        for line in body_content(body).splitlines():
            low = line.lower()
            if re.search(r"\b(none|no baseline|not yet)\b", low) and "plan:" not in low:
                problems.append("evaluation plan: a missing baseline needs 'Plan:' naming the run "
                                "that sets it (%r)" % line[:50])
    return problems


def parse_workflows(text):
    """Return (workflows, problems) from the workflow registry table."""
    problems = []
    for header, rows in _tables(_COMMENT.sub("", text)):
        if not header or header[0] != "workflow":
            continue
        cols, missing = _columns(header, WORKFLOW_COLUMNS)
        if missing:
            problems.append("workflow registry: missing column(s) %s" % ", ".join(missing))
            return [], problems
        flows = []
        for n, cells in rows:
            if not _WF_ID.fullmatch(_plain(cells[0]).upper()):
                if _filled(cells[0]):
                    problems.append("line %d: workflow id %r is not WF-n; the row is not "
                                    "registered" % (n, cells[0]))
                continue
            if len(cells) != len(header):
                problems.append("%s (line %d): cell count differs from the header"
                                % (cells[0], n))
                continue
            row = {key: cells[idx] for key, idx in cols.items()}
            row["line"] = n
            row["id"] = _plain(row["id"]).upper()
            flows.append(row)
        return flows, problems
    return [], ["workflow registry table is missing (header starts with 'Workflow')"]


def check_observability_contract(text):
    problems = _required_sections(text, OBS_SECTIONS, "observability contract")
    flows, wf_problems = parse_workflows(text)
    problems += ["observability contract: " + p for p in wf_problems]
    ids = {}
    for wf in flows:
        where = "observability contract %s (line %d)" % (wf["id"], wf["line"])
        ids[wf["id"]] = ids.get(wf["id"], 0) + 1
        cls = _plain(wf["class"])
        if cls not in WORKFLOW_CLASSES:
            problems.append("%s: class %r is not one of %s"
                            % (where, cls, ", ".join(WORKFLOW_CLASSES)))
        for key in ("entry", "emitters", "correlation", "records", "capture"):
            if not _filled(wf[key]) or _na_reason(wf[key]) is not None:
                problems.append("%s: '%s' must be filled for every covered workflow"
                                % (where, dict(WORKFLOW_COLUMNS)[key]))
        inherits = wf["inherits"]
        reason = _na_reason(inherits)
        if not _filled(inherits) or (reason is not None and not _reason_ok(reason)):
            problems.append("%s: name the evaluation and metrics it inherits, or 'n/a — <reason>'"
                            % where)
    if not flows and not wf_problems:
        problems.append("observability contract: the workflow registry has no WF-n rows")
    for wid, count in sorted(ids.items()):
        if count > 1:
            problems.append("observability contract %s: appears %d times" % (wid, count))

    classes = None
    for header, rows in _tables(_COMMENT.sub("", text)):
        if header and header[0] == "class" and any(h.startswith("present") for h in header):
            classes = rows
            break
    if classes is None:
        problems.append("observability contract: workflow-classes table is missing "
                        "(Class | Present | Workflows or reason)")
        return problems
    by_class = {}
    for n, cells in classes:
        cls = _plain(cells[0])
        if cls not in WORKFLOW_CLASSES:
            problems.append("observability contract: class row %r (line %d) is not one of %s"
                            % (cls, n, ", ".join(WORKFLOW_CLASSES)))
            continue
        by_class[cls] = (n, cells)
    flows_by_class = {}
    for wf in flows:
        flows_by_class.setdefault(_plain(wf["class"]), []).append(wf["id"])
    for cls in WORKFLOW_CLASSES:
        if cls not in by_class:
            problems.append("observability contract: class %s has no row; say which workflows "
                            "or why there are none" % cls)
            continue
        n, cells = by_class[cls]
        present = _plain(cells[1]) if len(cells) > 1 else ""
        detail = cells[2] if len(cells) > 2 else ""
        listed = set(_WF_ID.findall(detail.upper()))
        actual = set(flows_by_class.get(cls, []))
        if present == "yes":
            if not listed:
                problems.append("observability contract: class %s is present but lists no WF-n"
                                % cls)
            for wid in sorted(listed - actual):
                problems.append("observability contract: class %s lists %s, which is not a %s "
                                "row in the registry" % (cls, wid, cls))
            for wid in sorted(actual - listed):
                problems.append("observability contract: %s is a %s workflow but the class row "
                                "does not list it" % (wid, cls))
        elif present == "no":
            if not _reason_ok(_plain(detail)):
                problems.append("observability contract: class %s is absent without a reason"
                                % cls)
            if actual:
                problems.append("observability contract: class %s is marked absent but the "
                                "registry has %s" % (cls, ", ".join(sorted(actual))))
        else:
            problems.append("observability contract: class %s Present must be yes or no" % cls)
    return problems


def check_metrics_registry(text):
    problems = []
    for header, rows in _tables(_COMMENT.sub("", text)):
        if not header or header[0] != "metric":
            continue
        cols, missing = _columns(header, METRIC_COLUMNS)
        if missing:
            return ["metrics registry: missing column(s) %s" % ", ".join(missing)]
        seen = {}
        count = 0
        for n, cells in rows:
            mid = _plain(cells[0]).upper()
            if not _M_ID.match(mid):
                if _filled(cells[0]):
                    problems.append("metrics registry (line %d): metric id %r is not M-n"
                                    % (n, cells[0]))
                continue
            count += 1
            seen[mid] = seen.get(mid, 0) + 1
            where = "metrics registry %s (line %d)" % (mid, n)
            if len(cells) != len(header):
                problems.append("%s: cell count differs from the header (a '|' inside a cell?)"
                                % where)
                continue
            row = {key: cells[idx] for key, idx in cols.items()}
            for key, prefix in METRIC_COLUMNS[1:]:
                if not _filled(row[key]):
                    if key == "population":
                        problems.append("%s: no population or denominator — a metric without "
                                        "one is incomplete" % where)
                    else:
                        problems.append("%s: '%s' is empty" % (where, prefix))
            kind = _plain(row["kind"])
            if _filled(row["kind"]) and kind not in METRIC_KINDS:
                problems.append("%s: kind %r must be exactly one of %s"
                                % (where, kind, ", ".join(METRIC_KINDS)))
            if _filled(row["population"]) and _na_reason(row["population"]) is not None:
                problems.append("%s: population or denominator cannot be n/a; say what is "
                                "counted and over what" % where)
            target = _plain(row["target"])
            if _filled(row["target"]) and target != "measurement-only" \
                    and (not _APPROVED.search(target) or "not approved" in target
                         or "unapproved" in target):
                problems.append("%s: target %r has no approval; write 'measurement-only' or "
                                "'<value> — approved <decision>'" % (where, row["target"]))
            baseline = _plain(row["baseline"])
            if baseline.startswith("none") and "plan:" not in baseline:
                problems.append("%s: baseline 'none' needs 'Plan:' naming the run that sets it"
                                % where)
        if count == 0:
            problems.append("metrics registry: no M-n rows")
        for mid, c in sorted(seen.items()):
            if c > 1:
                problems.append("metrics registry %s: appears %d times" % (mid, c))
        return problems
    return ["metrics registry table is missing (header starts with 'Metric')"]


# --------------------------------------------------------------------------- CLI

def _repo_root(path):
    d = os.path.dirname(os.path.abspath(path))
    while True:
        if os.path.exists(os.path.join(d, ".git")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return os.path.dirname(os.path.abspath(path))
        d = parent


def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _report(problems, ok_message):
    for p in problems:
        sys.stdout.write("problem: %s\n" % p)
    if problems:
        sys.stdout.write("result: %d problem(s)\n" % len(problems))
        return 1
    sys.stdout.write("result: %s\n" % ok_message)
    return 0


def _cli(argv):
    parser = argparse.ArgumentParser(prog="design_outputs.py", description=__doc__.split("\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    p_sk = sub.add_parser("skeleton", help="print an empty register")
    p_sk.add_argument("--spec", default=DEFAULT_SPEC)
    p_ck = sub.add_parser("check", help="check a register at a gate")
    p_ck.add_argument("doc")
    p_ck.add_argument("--gate", choices=GATES)
    p_ck.add_argument("--spec", default=DEFAULT_SPEC)
    p_ck.add_argument("--root", help="directory Locations are relative to")
    for name in ("check-eval", "check-obs", "check-metrics"):
        p = sub.add_parser(name)
        p.add_argument("location", help="PATH or PATH#Heading")
    args = parser.parse_args(argv)

    if args.command in ("check-eval", "check-obs", "check-metrics"):
        text, err = load_location(args.location, os.getcwd())
        if err:
            sys.stderr.write("design_outputs.py: %s\n" % err)
            return 2
        fn = {"check-eval": check_evaluation_plan, "check-obs": check_observability_contract,
              "check-metrics": check_metrics_registry}[args.command]
        return _report(fn(text), "minimum contents present (structure); a reviewer still "
                                 "judges meaning")

    try:
        outputs = load_outputs(args.spec)
    except OSError as e:
        sys.stderr.write("design_outputs.py: cannot read %s: %s\n" % (args.spec, e))
        return 2
    if not outputs:
        sys.stderr.write("design_outputs.py: no DO-n outputs found in %s\n" % args.spec)
        return 2
    if args.command == "skeleton":
        sys.stdout.write(skeleton(outputs))
        return 0
    try:
        text = _read(args.doc)
    except OSError as e:
        sys.stderr.write("design_outputs.py: cannot read %s: %s\n" % (args.doc, e))
        return 2
    root = args.root or _repo_root(args.doc)
    problems = check_register(text, outputs, gate=args.gate, root=root)
    return _report(problems, "register holds at the %s gate (structure)" % (args.gate or "structure"))


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
