"""Coverage audit for a ticket set, and the reconciliation check for implementation plans.

Read-only and stdlib only. Format: references/coverage-audit.md beside this skill.

CLI:
    coverage_audit.py check AUDIT --tickets TICKETS [--workflows OBS ...] [--stage publish|verify]
        AUDIT holds the mandatory-requirements table and the coverage matrix. TICKETS holds every
        drafted (or exported) issue, each starting '## [PREFIX-NN] title'. OBS is the
        observability contract whose workflow registry lists every WF-n; without it the
        registry is read from AUDIT. Every ticket is checked, not a sample. --stage verify
        also requires every matrix row's evidence to start with 'verified:'.
    coverage_audit.py check-plan PLAN [--workflows OBS ...]
        Check an implementation plan's sources-checked table, source-contract reconciliation
        and entry-point registration (templates/implementation-plan.md).

Exit codes: 0 no problems, 1 problems found, 2 usage or file error.
Structure only: whether the requirement list is complete, whether an AC really proves its claim
and whether an N/A reason is true are a reviewer's judgement (references/coverage-audit.md).
"""
import argparse
import re
import sys

STAGES = ("publish", "verify")
CONTRACT_SECTIONS = {
    "observability": ("responsibilities", "capture evidence"),
    "evaluation": ("checks", "expected-answer authority"),
    "metrics": ("references", "acceptance conditions"),
}
PLAN_SOURCES = ("requirements", "component contracts", "evaluation plan",
                "observability contract", "key-metrics registry")
PLAN_DISPOSITIONS = ("in-ticket", "added", "other-ticket", "needs-decision", "blocked-on", "n/a")
PLAN_STATUSES = ("planned", "needs-decision", "blocked-on", "built")
UNIVERSAL = re.compile(r"\b(every|all|each|any|always|never|no)\b", re.I)

_TICKET_HEAD = re.compile(r"^##\s+\[([A-Za-z][A-Za-z0-9]*-\d+)\]\s*(.*)$")
_SECTION = re.compile(r"^###\s+(.*?)\s*$")
_AC_LINE = re.compile(r"^\s*-\s*\[[ xX]\]\s*(.*)$")
_AC_ID = re.compile(r"^(AC-\d+)\b")
_AC_REF = re.compile(r"\b([A-Za-z][A-Za-z0-9]*-\d+)\s+(AC-\d+)\b")
_WF_ID = re.compile(r"\bWF-\d+\b")
_M_ID = re.compile(r"\bM-\d+\b")
# "M-6 to M-9", "M-6…M-9", "M-6...M-9", "M-6–M-9" (en dash): every id from a to b.
_ID_RANGE = re.compile(r"\b([A-Z]+)-(\d+)\s*(?:to|…|\.\.\.|–)\s*\1-(\d+)\b", re.I)
_LIST_ITEM = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s")
_CONTINUATION = re.compile(r"^(?: {2,}|\t)\S")
_FIELD = re.compile(r"^\s*-\s*([^:]+):\s*(.*)$")
_SEPARATOR = re.compile(r"^\|?\s*:?-{2,}")
_PLACEHOLDER = re.compile(r"<[^<>]*>")
_EMPTY = {"", "-", "—", "–", "tbd", "todo", "?", "none", "na", "n/a", "not applicable",
          "nothing", "null", "pending", "unknown"}
_NA_PREFIX = re.compile(r"^(n/a|na|not applicable)(?=$|[\s—–:.(,-])")
_FENCE = re.compile(r"^\s*(```|~~~)")


def _cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _plain(value):
    return value.replace("`", "").replace("*", "").strip().lower()


def _filled(value):
    return _plain(_PLACEHOLDER.sub("", value)).strip(" .") not in _EMPTY


def _na_reason(value):
    """Reason after 'n/a' / 'NA' / 'not applicable' ('' if none); None if not an N/A.
    Placeholders never count as a reason."""
    text = _plain(_PLACEHOLDER.sub("", value))
    m = _NA_PREFIX.match(text)
    if not m:
        return None
    return text[m.end():].strip(" —–-:.()")


def strip_fences(text):
    """Blank out fenced code blocks, keeping line numbers: examples are not content."""
    out, inside = [], False
    for line in text.splitlines():
        if _FENCE.match(line):
            inside = not inside
            out.append("")
            continue
        out.append("" if inside else line)
    return "\n".join(out)


def join_continuations(text):
    """Return the lines of text with each wrapped list item joined onto one line.

    A continuation line is indented by two or more spaces (or a tab) and is not itself a new
    list item; it belongs to the item above it. A blank line or a new item ends the item."""
    out = []
    for line in text.splitlines():
        if out and _LIST_ITEM.match(out[-1]) and _CONTINUATION.match(line) \
                and not _LIST_ITEM.match(line):
            out[-1] = out[-1].rstrip() + " " + line.strip()
        else:
            out.append(line)
    return out


def _expand_ranges(text):
    def expand(m):
        lo, hi = sorted((int(m.group(2)), int(m.group(3))))
        return ", ".join("%s-%d" % (m.group(1), n) for n in range(lo, hi + 1))
    return _ID_RANGE.sub(expand, text)


def metric_ids(text):
    """Return the set of M-n ids in text, with ranges such as 'M-6 to M-9' expanded."""
    return set(_M_ID.findall(_expand_ranges(text).upper()))


def _reason_ok(reason):
    return bool(reason) and len(reason.split()) >= 3


def _tables(text):
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


def _col(header, prefix):
    return next((n for n, h in enumerate(header) if h.startswith(prefix)), None)


def _row_dict(header, cells, wanted):
    out = {}
    for key, prefix in wanted:
        idx = _col(header, prefix)
        out[key] = cells[idx] if idx is not None and idx < len(cells) else ""
    return out


# --------------------------------------------------------------------------- parsing

def parse_workflows(texts):
    """Return {WF-n: {"class", "inherits"}} from every workflow registry table in texts."""
    flows = {}
    for text in texts:
        for header, rows in _tables(text):
            if not header or header[0] != "workflow":
                continue
            for _, cells in rows:
                wid = _plain(cells[0]).upper()
                if _WF_ID.fullmatch(wid):
                    row = _row_dict(header, cells, (("class", "class"), ("inherits", "eval")))
                    flows[wid] = {"class": _plain(row["class"]), "inherits": row["inherits"]}
    return flows


def parse_tickets(text):
    """Return [{id, title, line, sections: {name: (line, body)}, text}] in file order."""
    tickets = []
    current = None
    section = None
    for n, line in enumerate(text.splitlines(), 1):
        head = _TICKET_HEAD.match(line)
        if head:
            current = {"id": head.group(1), "title": head.group(2), "line": n,
                       "sections": {}, "lines": []}
            tickets.append(current)
            section = None
            continue
        if current is None:
            continue
        current["lines"].append(line)
        sec = _SECTION.match(line)
        if sec:
            section = _plain(sec.group(1))
            current["sections"][section] = [n, []]
            continue
        if line.startswith("## "):
            section = None
            continue
        if section is not None:
            current["sections"][section][1].append(line)
    for t in tickets:
        t["text"] = "\n".join(t["lines"])
        t["sections"] = {k: (v[0], "\n".join(v[1])) for k, v in t["sections"].items()}
    return tickets


def _section(ticket, prefix):
    for name, value in ticket["sections"].items():
        if name.startswith(prefix):
            return value
    return None


def ticket_acs(ticket):
    """Return ({AC-n: line text}, problems) from the ticket's acceptance criteria."""
    acs, problems = {}, []
    sec = _section(ticket, "acceptance criteria")
    if sec is None:
        return acs, ["%s: no 'Acceptance criteria' section" % ticket["id"]]
    for line in join_continuations(sec[1]):
        m = _AC_LINE.match(line)
        if not m:
            continue
        body = m.group(1).strip()
        ac = _AC_ID.match(body)
        if not ac:
            problems.append("%s: acceptance criterion without an AC-n id: %s"
                            % (ticket["id"], body[:60]))
            continue
        if ac.group(1) in acs:
            problems.append("%s: %s appears twice" % (ticket["id"], ac.group(1)))
        acs[ac.group(1)] = body
        low = body.lower()
        if "verify:" not in low or "evidence:" not in low:
            problems.append("%s %s: needs 'verify:' and 'evidence:'" % (ticket["id"], ac.group(1)))
    if not acs and not problems:
        problems.append("%s: no acceptance criteria" % ticket["id"])
    return acs, problems


def contract_section(ticket, name):
    """Return (state, fields, problems): state is 'missing', 'na' or 'filled'."""
    sec = _section(ticket, name)
    if sec is None:
        return "missing", {}, ["%s: no '%s' section (write N/A — <reason> if it does not apply)"
                               % (ticket["id"], name.capitalize())]
    body = "\n".join(l for l in sec[1].splitlines() if l.strip())
    reason = _na_reason(body)
    if reason is not None:
        if not _reason_ok(reason):
            return "na", {}, ["%s: %s is N/A without a reason" % (ticket["id"], name.capitalize())]
        return "na", {}, []
    fields = {}
    for line in join_continuations(body):
        m = _FIELD.match(line)
        if m:
            fields[_plain(m.group(1))] = m.group(2).strip()
    problems = []
    for key in CONTRACT_SECTIONS[name]:
        value = next((v for k, v in fields.items() if k.startswith(key)), "")
        if not _filled(value):
            problems.append("%s: %s needs '%s:'" % (ticket["id"], name.capitalize(),
                                                    key[0].upper() + key[1:]))
    return "filled", fields, problems


def entry_points(ticket):
    """Return (declared?, [WF ids], free text) from 'Entry points added or changed:'."""
    for line in ticket["text"].splitlines():
        m = re.search(r"entry points added or changed:\s*(.*)$", line, re.I)
        if m:
            value = m.group(1).strip()
            return True, _WF_ID.findall(value.upper()), value
    return False, [], ""


def blockers(ticket, known_ids):
    sec = _section(ticket, "blocked by")
    if sec is None:
        return None
    found = set(re.findall(r"\b[A-Za-z][A-Za-z0-9]*-\d+\b", sec[1]))
    return found & known_ids


# --------------------------------------------------------------------------- ticket set

def check_tickets(tickets, workflows):
    problems = []
    ids = [t["id"] for t in tickets]
    for tid in sorted({i for i in ids if ids.count(i) > 1}):
        problems.append("%s: duplicate ticket ID" % tid)
    for t in tickets:
        acs, ac_problems = ticket_acs(t)
        problems.extend(ac_problems)
        states = {}
        fields = {}
        for name in CONTRACT_SECTIONS:
            state, f, p = contract_section(t, name)
            states[name], fields[name] = state, f
            problems.extend(p)
        declared, wfs, raw = entry_points(t)
        if not declared:
            problems.append("%s: no 'Entry points added or changed:' line (write None if it adds "
                            "or changes none)" % t["id"])
            continue
        if not wfs:
            if _plain(raw).strip(" .") not in ("none",):
                problems.append("%s: entry point '%s' has no registered WF-n; register it in the "
                                "observability contract first" % (t["id"], raw))
            continue
        for wf in wfs:
            if wf not in workflows:
                problems.append("%s: entry point %s is not in the observability contract's "
                                "workflow registry" % (t["id"], wf))
                continue
            if states["observability"] == "na":
                problems.append("%s: adds or changes %s but declares Observability N/A"
                                % (t["id"], wf))
            elif states["observability"] == "filled":
                obs = fields["observability"]
                resp = next((v for k, v in obs.items() if k.startswith("responsibilities")), "")
                capture = next((v for k, v in obs.items() if k.startswith("capture evidence")), "")
                if wf not in resp.upper():
                    problems.append("%s: Observability responsibilities do not name %s"
                                    % (t["id"], wf))
                cited = set(re.findall(r"\bAC-\d+\b", capture.upper()))
                if not cited or not cited <= set(acs):
                    problems.append("%s: Observability capture evidence must cite this ticket's "
                                    "capture AC-n for %s" % (t["id"], wf))
            eval_part = re.sub(r"\bM-\d+\b|\bEV\b|[;:,.]", " ",
                               _expand_ranges(workflows[wf]["inherits"]))
            if _na_reason(workflows[wf]["inherits"]) is None and _filled(eval_part) \
                    and states["evaluation"] == "na":
                problems.append("%s: %s inherits evaluation (%s) but Evaluation is N/A"
                                % (t["id"], wf, workflows[wf]["inherits"].strip()))
            cell = workflows[wf]["inherits"]
            inherited = set() if _na_reason(cell) is not None else metric_ids(cell)
            if inherited:
                refs = metric_ids(" ".join(fields["metrics"].values()))
                if states["metrics"] == "na":
                    problems.append("%s: %s inherits %s but Metrics is N/A"
                                    % (t["id"], wf, ", ".join(sorted(inherited))))
                elif inherited - refs:
                    problems.append("%s: %s inherits %s; Metrics does not reference %s"
                                    % (t["id"], wf, ", ".join(sorted(inherited)),
                                       ", ".join(sorted(inherited - refs))))
    return problems


# --------------------------------------------------------------------------- audit

REQ_COLUMNS = (("id", "req"), ("text", "requirement"), ("source", "source"),
               ("applies", "applies"))
MATRIX_COLUMNS = (("req", "req"), ("workflow", "workflow"), ("component", "component"),
                  ("implementing", "implementing"), ("integration", "integration"),
                  ("ac", "acceptance"), ("evidence", "evidence"))


def parse_audit(text):
    reqs, matrix = None, None
    for header, rows in _tables(text):
        if not header or header[0] != "req":
            continue
        if _col(header, "applies") is not None:
            reqs = [(n, _row_dict(header, c, REQ_COLUMNS)) for n, c in rows]
        elif _col(header, "implementing") is not None:
            matrix = [(n, _row_dict(header, c, MATRIX_COLUMNS)) for n, c in rows]
    return reqs, matrix


def _scope(applies, registry):
    """Return (included, excluded, has_exclusion_reason, is_all) from an 'Applies to' cell."""
    text = applies.replace("`", "")
    parts = re.split(r"(?i)exclud\w*", text, maxsplit=1)
    head, tail = parts[0], parts[1] if len(parts) > 1 else ""
    if _plain(head).startswith("all"):
        included = set(registry) - set(_WF_ID.findall(tail.upper()))
        is_all = True
    else:
        included = set(_WF_ID.findall(head.upper()))
        is_all = False
    excluded = set(_WF_ID.findall(tail.upper()))
    reason_words = re.sub(r"WF-\d+", "", tail, flags=re.I)
    if not is_all and not excluded and re.search(r"(?i)\bonly\b", head):
        # "WF-1 only — <reason>": every other workflow is excluded for that reason.
        excluded = set(registry) - included
        reason_words = re.sub(r"(?i)WF-\d+|\bonly\b", "", head)
    return included, excluded, _reason_ok(_plain(reason_words).strip(" ():,;—-")), is_all


def check_audit(audit_text, tickets, workflows, stage="publish"):
    problems = []
    reqs, matrix = parse_audit(audit_text)
    if reqs is None:
        problems.append("audit: mandatory-requirements table is missing "
                        "(Req | Requirement | Source | Applies to)")
        reqs = []
    if matrix is None:
        problems.append("audit: coverage matrix is missing (Req | Workflow | Component / contract "
                        "| Implementing ticket | Integration owner | Acceptance criterion | Evidence)")
        matrix = []
    if not workflows:
        problems.append("audit: no workflow registry (pass --workflows with the observability "
                        "contract, or add a Workflow table)")
    by_id = {t["id"]: t for t in tickets}
    acs = {t["id"]: ticket_acs(t)[0] for t in tickets}
    known = set(by_id)

    scopes = {}
    for n, r in reqs:
        rid = _plain(r["id"]).upper()
        where = "%s (line %d)" % (rid, n)
        if not _filled(r["id"]):
            if _filled(r["text"]):
                problems.append("requirement (line %d) has text but no Req id; its coverage "
                                "cannot be checked" % n)
            continue
        if rid in scopes:
            problems.append("%s: duplicate Req id; each requirement needs its own id" % where)
        if not _filled(r["source"]):
            problems.append("%s: no source section" % where)
        included, excluded, reason, is_all = _scope(r["applies"], workflows)
        for wf in sorted((included | excluded) - set(workflows)):
            problems.append("%s: applies to %s, which is not in the workflow registry" % (where, wf))
        if not included:
            problems.append("%s: 'Applies to' names no workflow (write 'all' or WF-n ids)" % where)
        if excluded and not reason:
            problems.append("%s: excludes %s without a reason" % (where, ", ".join(sorted(excluded))))
        if UNIVERSAL.search(r["text"]) and not is_all and workflows:
            unaccounted = set(workflows) - included - excluded
            if unaccounted:
                problems.append("%s: narrowed guarantee — the requirement says '%s' but applies to "
                                "%s and neither covers nor excludes %s"
                                % (where, UNIVERSAL.search(r["text"]).group(1),
                                   ", ".join(sorted(included)) or "nothing",
                                   ", ".join(sorted(unaccounted))))
        scopes[rid] = included

    covered = {}
    used_acs = {}
    for n, row in matrix:
        rid = _plain(row["req"]).upper()
        if not _filled(row["req"]):
            continue
        where = "%s row (line %d)" % (rid, n)
        if rid not in scopes:
            problems.append("%s: not a mandatory requirement in the requirements table" % where)
        wfs = _WF_ID.findall(row["workflow"].upper())
        if len(wfs) != 1:
            problems.append("%s: needs exactly one consuming workflow; a shared component or "
                            "adapter does not show that its consumers use it — add one row per "
                            "workflow" % where)
        wf = wfs[0] if len(wfs) == 1 else None
        if wf and workflows and wf not in workflows:
            problems.append("%s: %s is not in the workflow registry" % (where, wf))
        if wf and rid in scopes and wf not in scopes[rid]:
            problems.append("%s: %s is outside %s's 'Applies to'" % (where, wf, rid))
        if not _filled(row["component"]):
            problems.append("%s: no component or contract" % where)
        impl = row["implementing"].strip(" `")
        owner = row["integration"].strip(" `")
        if impl not in known:
            problems.append("%s: implementing ticket %r is not in the ticket set" % (where, impl))
        if not _filled(owner):
            problems.append("%s: unowned integration — name the ticket that wires the component "
                            "into %s" % (where, wf or "its workflow"))
        elif owner not in known:
            problems.append("%s: integration owner %r is not in the ticket set" % (where, owner))
        ref = _AC_REF.search(row["ac"])
        if not ref:
            problems.append("%s: acceptance criterion must be '<ticket> AC-n'" % where)
        else:
            ac_ticket, ac_id = ref.group(1), ref.group(2)
            if ac_ticket not in known or ac_id not in acs.get(ac_ticket, {}):
                problems.append("%s: %s %s does not exist" % (where, ac_ticket, ac_id))
            elif owner in known and ac_ticket != owner:
                problems.append("%s: %s %s proves the component, not its use in %s; cite an "
                                "acceptance criterion on the integration owner %s"
                                % (where, ac_ticket, ac_id, wf or "the workflow", owner))
            elif wf and wf not in acs[ac_ticket][ac_id].upper():
                problems.append("%s: %s %s does not name %s; a criterion proves a workflow only "
                                "when it drives that workflow's entry point"
                                % (where, ac_ticket, ac_id, wf))
            if wf:
                key = (rid, ac_ticket, ac_id)
                if key in used_acs and used_acs[key] != wf:
                    problems.append("%s: %s %s is already the proof for %s; each workflow needs "
                                    "its own criterion" % (where, ac_ticket, ac_id, used_acs[key]))
                used_acs.setdefault(key, wf)
        if not _filled(row["evidence"]):
            problems.append("%s: no evidence named" % where)
        elif stage == "verify":
            ev = _plain(row["evidence"])
            if not ev.startswith("verified:") or not _filled(ev[len("verified:"):]):
                problems.append("%s: evidence not verified (write 'verified: <link or run>')"
                                % where)
        if impl in known and owner in known and owner != impl:
            blocked = blockers(by_id[owner], known)
            if blocked is None or impl not in blocked:
                problems.append("%s: %s integrates %s's component but is not blocked by %s"
                                % (where, owner, impl, impl))
        if wf:
            covered.setdefault(rid, set()).add(wf)

    for rid, included in sorted(scopes.items()):
        for wf in sorted(included - covered.get(rid, set())):
            problems.append("%s: no coverage row for %s — missing consumer integration"
                            % (rid, wf))
    return problems


# --------------------------------------------------------------------------- plans

def check_plan(text, workflows=None):
    problems = []
    status = re.search(r"(?im)^\**status:?\**:?\s*`?([A-Za-z-]+)", text)
    status = _plain(status.group(1)) if status else ""
    if status not in PLAN_STATUSES:
        problems.append("plan: 'Status:' must be one of %s" % ", ".join(PLAN_STATUSES))

    sources = reconciliation = registration = None
    for header, rows in _tables(text):
        if not header:
            continue
        rows = [(n, c) for n, c in rows if any(_filled(x) for x in c)]  # skip blank template rows
        if header[0].startswith("source") and _col(header, "location") is not None:
            sources = (header, rows)
        elif header[0].startswith("obligation"):
            reconciliation = (header, rows)
        elif header[0].startswith("entry point"):
            registration = (header, rows)

    if sources is None:
        problems.append("plan: 'Sources checked' table is missing (Source | Location | What it "
                        "obliges)")
    else:
        header, rows = sources
        seen = {_plain(c[0]): (n, c) for n, c in rows}
        loc = _col(header, "location")
        obl = _col(header, "what")
        for name in PLAN_SOURCES:
            hit = next((v for k, v in seen.items() if k.startswith(name)), None)
            if hit is None:
                problems.append("plan: sources checked has no '%s' row" % name)
                continue
            value = hit[1][loc] if loc < len(hit[1]) else ""
            reason = _na_reason(value)
            if not _filled(value) or (reason is not None and not _reason_ok(reason)):
                problems.append("plan: sources checked '%s' needs a location or 'n/a — <reason>'"
                                % name)
            elif reason is None and obl is not None and \
                    (obl >= len(hit[1]) or not _filled(hit[1][obl])):
                problems.append("plan: sources checked '%s' must say what it obliges here"
                                % name)

    open_items = False
    if reconciliation is None:
        problems.append("plan: source-contract reconciliation table is missing")
    else:
        header, rows = reconciliation
        cols = dict((k, _col(header, p)) for k, p in (
            ("obligation", "obligation"), ("source", "governing"), ("in_ticket", "in ticket"),
            ("disposition", "disposition"), ("where", "plan step")))
        if any(v is None for v in cols.values()):
            problems.append("plan: reconciliation needs columns Obligation | Governing source | "
                            "In ticket | Disposition | Plan step or owner")
            rows = []
        if not rows:
            problems.append("plan: reconciliation lists no obligations; list each governing "
                            "obligation, including those the ticket already states")
        for n, c in rows:
            get = lambda k: c[cols[k]] if cols[k] < len(c) else ""
            where = "plan reconciliation (line %d)" % n
            disp = _plain(get("disposition")).split()[0] if _filled(get("disposition")) else ""
            if disp not in PLAN_DISPOSITIONS:
                problems.append("%s: disposition %r is not one of %s"
                                % (where, disp, ", ".join(PLAN_DISPOSITIONS)))
                continue
            if not _filled(get("obligation")) or not _filled(get("source")):
                problems.append("%s: needs the obligation and its governing source" % where)
            if disp == "in-ticket" and "AC-" not in get("in_ticket").upper():
                problems.append("%s: in-ticket must cite the ticket's AC-n" % where)
            if disp == "added" and not _filled(get("where")):
                problems.append("%s: added obligation needs the plan step that delivers it" % where)
            if disp == "other-ticket" and not re.search(r"[A-Za-z][A-Za-z0-9]*-\d+", get("where")):
                problems.append("%s: other-ticket must name the ticket that owns it" % where)
            if disp == "n/a" and not _reason_ok(_plain(get("where")) + " " +
                                                (_na_reason(get("disposition")) or "")):
                problems.append("%s: n/a needs a reason" % where)
            if disp in ("needs-decision", "blocked-on"):
                open_items = True
                if status != disp:
                    problems.append("%s: %s obligation but plan Status is %r"
                                    % (where, disp, status))

    if registration is None:
        problems.append("plan: entry-point registration table is missing (write one 'None' row "
                        "if the ticket adds or changes no entry point)")
    else:
        header, rows = registration
        wf_col, reg_col, inh_col = _col(header, "workflow"), _col(header, "registered"), \
            _col(header, "inherits")
        if None in (wf_col, reg_col, inh_col):
            problems.append("plan: registration needs columns Entry point | Workflow | Registered "
                            "in contract | Inherits")
            rows = []
        for n, c in rows:
            if _plain(c[0]) in ("none", "none."):
                continue
            where = "plan registration (line %d)" % n
            wfs = _WF_ID.findall(c[wf_col].upper()) if wf_col < len(c) else []
            if not wfs:
                problems.append("%s: entry point '%s' has no WF-n" % (where, c[0]))
            if workflows is None and wfs:
                problems.append("%s: pass --workflows <observability contract> so %s's "
                                "registration can be verified" % (where, ", ".join(wfs)))
            for wf in wfs:
                if workflows is not None and wf not in workflows:
                    problems.append("%s: %s is not in the observability contract" % (where, wf))
                elif workflows is not None:
                    cell = workflows[wf]["inherits"]
                    need = set() if _na_reason(cell) is not None else metric_ids(cell)
                    have = metric_ids(c[inh_col]) if inh_col < len(c) else set()
                    if need - have:
                        problems.append("%s: %s inherits %s in the contract; the plan omits %s"
                                        % (where, wf, ", ".join(sorted(need)),
                                           ", ".join(sorted(need - have))))
            registered = _plain(c[reg_col]) if reg_col < len(c) else ""
            if not registered.startswith("yes") and status != "blocked-on":
                problems.append("%s: '%s' is not registered in the observability contract; "
                                "register it first or set Status: BLOCKED-ON" % (where, c[0]))
            if inh_col >= len(c) or not _filled(c[inh_col]):
                problems.append("%s: name the evaluation and metrics it inherits" % where)
    return problems, open_items


# --------------------------------------------------------------------------- CLI

def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _cli(argv):
    parser = argparse.ArgumentParser(prog="coverage_audit.py", description=__doc__.split("\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    p_ck = sub.add_parser("check", help="audit a ticket set against its coverage matrix")
    p_ck.add_argument("audit")
    p_ck.add_argument("--tickets", required=True)
    p_ck.add_argument("--workflows", action="append", default=[],
                      help="observability contract with the workflow registry (repeatable)")
    p_ck.add_argument("--stage", choices=STAGES, default="publish")
    p_pl = sub.add_parser("check-plan", help="check an implementation plan")
    p_pl.add_argument("plan")
    p_pl.add_argument("--workflows", action="append", default=[])
    args = parser.parse_args(argv)

    try:
        wf_texts = [_read(p) for p in args.workflows]
        if args.command == "check-plan":
            plan_text = _read(args.plan)
        else:
            audit_text, tickets_text = _read(args.audit), _read(args.tickets)
    except OSError as e:
        sys.stderr.write("coverage_audit.py: %s\n" % e)
        return 2

    if args.command == "check-plan":
        workflows = parse_workflows(wf_texts) if wf_texts else None
        problems, open_items = check_plan(plan_text, workflows)
        tail = ("plan is not ready for execution: open decisions or blockers"
                if open_items else "plan reconciles its sources (structure); a reviewer judges "
                                   "whether the obligation list is complete")
    else:
        workflows = parse_workflows(wf_texts or [audit_text])
        tickets = parse_tickets(tickets_text)
        if not tickets:
            sys.stderr.write("coverage_audit.py: no '## [PREFIX-NN] title' tickets in %s\n"
                             % args.tickets)
            return 2
        problems = check_tickets(tickets, workflows)
        problems += check_audit(audit_text, tickets, workflows, args.stage)
        sys.stdout.write("tickets checked: %d (the whole set) · workflows: %d\n"
                         % (len(tickets), len(workflows)))
        tail = "coverage holds at the %s stage (structure); a reviewer still judges meaning" \
               % args.stage
    for p in problems:
        sys.stdout.write("problem: %s\n" % p)
    if problems:
        sys.stdout.write("result: %d problem(s)\n" % len(problems))
        return 1
    sys.stdout.write("result: %s\n" % tail)
    return 1 if args.command == "check-plan" and open_items else 0


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
