"""Living PRD-interview document: coverage skeleton and gate check.

Read-only and stdlib only. The document format is references/interview-document.md.

CLI:
    interview.py skeleton [--checklist PATH]
        Print the checklist-coverage table: one row per readiness item, with its
        Kind, Tier and default stage, and the disposition left as TBD.
    interview.py check DOC [--checklist PATH] [--outputs PATH] [--complete]
        Report structural problems (missing or duplicate checklist rows, invalid
        dispositions or statuses, missing evidence, unknown references, a missing
        or incomplete Design outputs register). With --complete, also fail while
        any item, Observability map row or question is still open, or while any
        required design output lacks an owner, a known location or sources.
        Answered questions never stand in for a missing output record.

Exit codes: 0 no problems, 1 problems found, 2 usage or file error.
The CLI is guarded behind __main__ so importing has no side effects.
"""
import argparse
import os
import re
import sys

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
READINESS_ROOT = os.path.normpath(os.path.join(SKILL_ROOT, os.pardir, "system-design-readiness"))
DEFAULT_CHECKLIST = os.path.join(READINESS_ROOT, "CHECKLIST.md")
DEFAULT_OUTPUTS = os.path.join(READINESS_ROOT, "DESIGN-OUTPUTS.md")
OUTPUTS_CHECKER = os.path.join(READINESS_ROOT, "scripts", "design_outputs.py")

DISPOSITIONS = ("answered", "needs-decision", "needs-research", "assumed", "n/a")
OPEN_DISPOSITIONS = {"needs-decision", "needs-research"}
STATUSES = (
    "provisional", "ready", "asked", "answered",
    "carried", "deferred", "retired", "revisit",
)
OPEN_STATUSES = {"provisional", "ready", "asked", "revisit"}
LAYERS = ("product", "design-input", "design")

_SD_ROW = re.compile(r"^\|\s*(SD-\d+\.\d+)\s*\|")
_STAGE_ROW = re.compile(r"^\|\s*(S\d+)\b")
_STAGE_REF = re.compile(r"^S\d+$")
_SD_REF = re.compile(r"\bSD-\d+\.\d+\b")
_Q_HEAD = re.compile(r"^###\s+(Q-\d{3,})\b")
_Q_REF = re.compile(r"\bQ-\d{3,}\b")
_EMPTY = {"", "-", "—", "–", "tbd", "n/a"}


def load_outputs_checker(path=OUTPUTS_CHECKER):
    """Import system-design-readiness/scripts/design_outputs.py, the one register checker."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("design_outputs", path)
    if spec is None or not os.path.isfile(path):
        raise OSError("design-outputs checker not found at %s" % path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _plain(value):
    return value.replace("`", "").replace("*", "").strip().lower()


def _empty(value):
    return _plain(value) in _EMPTY


def default_stage(item_id):
    """Default stage for a checklist ID: step N -> SN, except SD-7.4 -> S5."""
    if item_id == "SD-7.4":
        return "S5"
    return "S" + item_id[3:].split(".")[0]


def load_checklist(path):
    """Return [{id, kind, tier}] for every live SD row in the readiness checklist.

    Struck-through (retired) IDs do not match and are skipped.
    """
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    items = []
    for line in lines:
        if not _SD_ROW.match(line):
            continue
        cells = _cells(line)
        if len(cells) < 4:
            continue
        items.append({"id": cells[0], "kind": cells[2], "tier": cells[3]})
    return items


def skeleton(items):
    rows = [
        "| ID | Kind | Tier | Stage | Disposition | Evidence, reason or plan | Questions |",
        "|---|---|---|---|---|---|---|",
    ]
    for it in items:
        rows.append("| %s | %s | %s | %s | TBD | | |" % (
            it["id"], it["kind"], it["tier"], default_stage(it["id"])))
    return "\n".join(rows) + "\n"


def parse_document(text):
    """Return {"coverage", "observability", "questions", "problems"} parsed from a document."""
    lines = text.splitlines()
    coverage, observability, questions, problems = [], [], [], []
    header = None
    obs_header = None
    current = None

    for n, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("|") and "disposition" in stripped.lower():
            cells = [_plain(c) for c in _cells(stripped)]
            if cells and cells[0] == "id":
                header = cells
                continue
            if cells and cells[0] == "stage":
                obs_header = cells
                continue
        if obs_header is not None and _STAGE_ROW.match(stripped):
            cells = _cells(stripped)
            if len(cells) != len(obs_header):
                problems.append(
                    "line %d: observability row %s has %d cells but the header has %d"
                    % (n, cells[0], len(cells), len(obs_header)))
                continue
            row = {"line": n, "stage": _STAGE_ROW.match(stripped).group(1)}
            for name, value in zip(obs_header, cells):
                if name.startswith("disposition"):
                    row["disposition"] = _plain(value)
                elif name.startswith("evidence"):
                    row["evidence"] = value
                elif name.startswith("question"):
                    row["questions"] = value
                elif name.startswith("item"):
                    row["items"] = value
            observability.append(row)
            continue
        if _SD_ROW.match(stripped):
            cells = _cells(stripped)
            if header is None:
                problems.append("line %d: %s row appears before a coverage header" % (n, cells[0]))
                continue
            if len(cells) != len(header):
                problems.append(
                    "line %d: %s has %d cells but the header has %d (a '|' inside a cell?)"
                    % (n, cells[0], len(cells), len(header)))
                continue
            row = {"line": n}
            for name, value in zip(header, cells):
                if name == "id":
                    row["id"] = value
                elif name.startswith("kind"):
                    row["kind"] = value
                elif name.startswith("stage"):
                    row["stage"] = value
                elif name.startswith("disposition"):
                    row["disposition"] = _plain(value)
                elif name.startswith("evidence"):
                    row["evidence"] = value
                elif name.startswith("question"):
                    row["questions"] = value
            coverage.append(row)
            continue

        head = _Q_HEAD.match(stripped)
        if head:
            current = {"id": head.group(1), "line": n, "fields": {}}
            questions.append(current)
            continue
        if stripped.startswith("#"):
            current = None
            obs_header = None
            continue
        if current is not None and line.startswith("- ") and ":" in line:
            key, value = line[2:].split(":", 1)
            current["fields"][key.strip().lower()] = value.strip()

    return {"coverage": coverage, "observability": observability,
            "questions": questions, "problems": problems}


def check(text, items, complete=False, outputs=None, outputs_mod=None):
    """Return (problems, summary) for an interview document against checklist items.

    outputs: the required design outputs ([{id, name}]); loaded from DESIGN-OUTPUTS.md when
    omitted. The register is checked for structure, and at the interview gate with complete.
    """
    doc = parse_document(text)
    problems = list(doc["problems"])
    try:
        outputs_mod = outputs_mod or load_outputs_checker()
        if outputs is None:
            outputs = outputs_mod.load_outputs(DEFAULT_OUTPUTS)
        problems.extend(outputs_mod.check_register(
            text, outputs, gate="interview" if complete else None))
        register_rows = len(outputs_mod.parse_register(text)[0])
    except OSError as e:
        problems.append("design outputs cannot be checked: %s" % e)
        outputs, register_rows = outputs or [], 0
    known_items = {it["id"]: it for it in items}
    q_ids = [q["id"] for q in doc["questions"]]
    known_q = set(q_ids)

    for qid in sorted({q for q in q_ids if q_ids.count(q) > 1}):
        problems.append("%s: duplicate question ID" % qid)

    # Checklist coverage.
    seen = {}
    for row in doc["coverage"]:
        rid = row.get("id", "?")
        seen[rid] = seen.get(rid, 0) + 1
        where = "%s (line %d)" % (rid, row["line"])
        if rid not in known_items:
            problems.append("%s: not an item in the readiness checklist" % where)
        disp = row.get("disposition", "")
        evidence = row.get("evidence", "")
        if disp not in DISPOSITIONS:
            problems.append("%s: disposition %r is not one of %s"
                            % (where, disp or "", ", ".join(DISPOSITIONS)))
        elif _empty(evidence):
            problems.append("%s: %s needs evidence, a reason or a next action" % (where, disp))
        if disp == "assumed":
            kind = row.get("kind") or known_items.get(rid, {}).get("kind", "")
            if "measure" not in kind.lower():
                problems.append("%s: assumed is allowed only for Measure items (Kind: %s)"
                                % (where, kind or "unknown"))
            if "plan:" not in evidence.lower():
                problems.append("%s: assumed needs 'Plan:' naming the measurement that replaces it"
                                % where)
        if _empty(row.get("stage", "")):
            problems.append("%s: no stage" % where)
        for ref in _Q_REF.findall(row.get("questions", "")):
            if ref not in known_q:
                problems.append("%s: refers to unknown question %s" % (where, ref))
        if complete and disp in OPEN_DISPOSITIONS:
            problems.append("%s: still %s" % (where, disp))

    for it in items:
        if it["id"] not in seen:
            problems.append("%s: missing from checklist coverage" % it["id"])
    for rid, count in sorted(seen.items()):
        if count > 1:
            problems.append("%s: appears %d times in checklist coverage" % (rid, count))

    # Observability map: one closed row per stage used by the coverage table.
    obs = doc["observability"]
    if not obs:
        problems.append("Observability map is missing (one row per stage; see observability.md)")
    obs_seen = {}
    for row in obs:
        stage = row["stage"]
        obs_seen[stage] = obs_seen.get(stage, 0) + 1
        where = "observability %s (line %d)" % (stage, row["line"])
        disp = row.get("disposition", "")
        evidence = row.get("evidence", "")
        if disp not in DISPOSITIONS:
            problems.append("%s: disposition %r is not one of %s"
                            % (where, disp or "", ", ".join(DISPOSITIONS)))
        elif _empty(evidence):
            problems.append("%s: %s needs evidence, a reason or a next action" % (where, disp))
        if disp == "assumed" and "plan:" not in evidence.lower():
            problems.append("%s: assumed needs 'Plan:' naming the measurement that replaces it"
                            % where)
        for ref in _SD_REF.findall(row.get("items", "")):
            if ref not in known_items:
                problems.append("%s: item %s is not in the readiness checklist" % (where, ref))
        for ref in _Q_REF.findall(row.get("questions", "")):
            if ref not in known_q:
                problems.append("%s: refers to unknown question %s" % (where, ref))
        if complete and disp in OPEN_DISPOSITIONS:
            problems.append("%s: still %s" % (where, disp))
    if obs:
        stages = sorted({_plain(r.get("stage", "")).upper() for r in doc["coverage"]
                         if _STAGE_REF.match(_plain(r.get("stage", "")).upper())},
                        key=lambda x: int(x[1:]))
        for stage in stages:
            if stage not in obs_seen:
                problems.append("observability %s: no Observability map row for this stage" % stage)
        for stage, count in sorted(obs_seen.items()):
            if count > 1:
                problems.append("observability %s: appears %d times" % (stage, count))

    # Questions.
    for q in doc["questions"]:
        f = q["fields"]
        where = "%s (line %d)" % (q["id"], q["line"])
        status = _plain(f.get("status", ""))
        if status not in STATUSES:
            problems.append("%s: status %r is not one of %s"
                            % (where, status, ", ".join(STATUSES)))
        if _empty(f.get("stage", "")):
            problems.append("%s: no stage" % where)
        layer = _plain(f.get("layer", ""))
        if layer and layer not in LAYERS:
            problems.append("%s: layer %r is not one of %s" % (where, layer, ", ".join(LAYERS)))
        if layer == "design" and status in ("answered", "carried"):
            problems.append("%s: a design-layer question is deferred to system design, not settled here"
                            % where)
        for ref in _SD_REF.findall(f.get("sources", "")):
            if ref not in known_items:
                problems.append("%s: source %s is not in the readiness checklist" % (where, ref))
        for ref in _Q_REF.findall(f.get("depends on", "")):
            if ref not in known_q:
                problems.append("%s: depends on unknown question %s" % (where, ref))
            if ref == q["id"]:
                problems.append("%s: depends on itself" % where)
        if status in ("answered", "carried") and _empty(f.get("evidence", "")):
            problems.append("%s: %s needs evidence" % (where, status))
        if status == "answered" and _empty(f.get("answer", "")):
            problems.append("%s: answered but no answer recorded" % where)
        if status in ("deferred", "retired") and _empty(f.get("decision", "")):
            problems.append("%s: %s needs a destination or reason in Decision" % (where, status))
        if complete and status in OPEN_STATUSES:
            problems.append("%s: still %s" % (where, status))

    counts = {}
    for row in doc["coverage"]:
        counts[row.get("disposition", "")] = counts.get(row.get("disposition", ""), 0) + 1
    q_counts = {}
    for q in doc["questions"]:
        s = _plain(q["fields"].get("status", ""))
        q_counts[s] = q_counts.get(s, 0) + 1
    open_items = sum(counts.get(d, 0) for d in OPEN_DISPOSITIONS)
    open_items += sum(1 for r in obs if r.get("disposition") in OPEN_DISPOSITIONS)
    open_qs = sum(q_counts.get(s, 0) for s in OPEN_STATUSES)
    summary = {
        "items": len(doc["coverage"]),
        "dispositions": counts,
        "observability": len(obs),
        "questions": len(doc["questions"]),
        "statuses": q_counts,
        "open": open_items + open_qs,
        "outputs": register_rows,
        "required_outputs": len(outputs),
    }
    return problems, summary


def _fmt(counts, order):
    return ", ".join("%s %d" % (k, counts[k]) for k in order if counts.get(k))


def _cli(argv):
    parser = argparse.ArgumentParser(prog="interview.py", description=__doc__.split("\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    p_sk = sub.add_parser("skeleton", help="print the full checklist-coverage table")
    p_sk.add_argument("--checklist", default=DEFAULT_CHECKLIST)
    p_ck = sub.add_parser("check", help="check an interview document")
    p_ck.add_argument("doc")
    p_ck.add_argument("--checklist", default=DEFAULT_CHECKLIST)
    p_ck.add_argument("--outputs", default=DEFAULT_OUTPUTS,
                      help="DESIGN-OUTPUTS.md listing the required design outputs")
    p_ck.add_argument("--complete", action="store_true",
                      help="also fail while any item or question is open")
    args = parser.parse_args(argv)

    try:
        items = load_checklist(args.checklist)
    except OSError as e:
        sys.stderr.write("interview.py: cannot read checklist %s: %s\n" % (args.checklist, e))
        return 2
    if not items:
        sys.stderr.write("interview.py: no SD-x.y items found in %s\n" % args.checklist)
        return 2

    if args.command == "skeleton":
        sys.stdout.write(skeleton(items))
        return 0

    try:
        with open(args.doc, encoding="utf-8") as f:
            text = f.read()
    except OSError as e:
        sys.stderr.write("interview.py: cannot read %s: %s\n" % (args.doc, e))
        return 2
    try:
        mod = load_outputs_checker()
        outputs = mod.load_outputs(args.outputs)
    except OSError as e:
        sys.stderr.write("interview.py: cannot load design outputs: %s\n" % e)
        return 2
    if not outputs:
        sys.stderr.write("interview.py: no DO-n outputs found in %s\n" % args.outputs)
        return 2
    problems, s = check(text, items, complete=args.complete, outputs=outputs, outputs_mod=mod)
    sys.stdout.write("coverage: %d of %d items — %s\n" % (
        s["items"], len(items), _fmt(s["dispositions"], DISPOSITIONS) or "none"))
    sys.stdout.write("observability map: %d stage row(s)\n" % s["observability"])
    sys.stdout.write("design outputs: %d row(s) for %d required\n" % (
        s["outputs"], s["required_outputs"]))
    sys.stdout.write("questions: %d — %s\n" % (
        s["questions"], _fmt(s["statuses"], STATUSES) or "none"))
    for p in problems:
        sys.stdout.write("problem: %s\n" % p)
    if problems:
        sys.stdout.write("result: %d problem(s)%s\n" % (
            len(problems), " — interview is not complete" if args.complete else ""))
        return 1
    if args.complete:
        sys.stdout.write("result: completion gate holds (structure); confirm the judgement items\n")
    else:
        sys.stdout.write("result: structure ok; %d item(s) or question(s) still open\n" % s["open"])
    return 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
