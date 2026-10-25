"""Checklist-pack engine: load, validate, and assemble PRDs from packs.

Stdlib only. See references/pack-format.md for the pack grammar and the
canonical PRD section order. The CLI (`checklist.py validate <pack>`) is
guarded behind __main__ so importing this module has no side effects.
"""
import sys


# Canonical PRD section order (assembler target). Copied from pack-format.md.
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
SECTION_IDS = set(SECTION_ORDER)


def _strip_comment(value):
    """Drop a trailing ` # comment` from a field value, if present."""
    idx = value.find("#")
    if idx != -1:
        value = value[:idx]
    return value.strip()


def _split_field(line):
    """Split a `- Key: value` line into (key, value). Returns None if not one.

    Tolerates spaces around the colon and a missing space after it.
    """
    body = line.lstrip()
    if not body.startswith("-"):
        return None
    body = body[1:].strip()
    if ":" not in body:
        return None
    key, value = body.split(":", 1)
    return key.strip(), value.strip()


def _parse_bool(value):
    return str(value).strip().lower() == "true"


def load_pack(path):
    """Parse a checklist pack markdown file into a structured dict."""
    with open(path) as f:
        lines = f.read().splitlines()

    pack = {
        "version": None,
        "track": None,
        "description": None,
        "phases": [],
    }
    current_phase = None
    current_q = None

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        # Header: "# Checklist: <title>"
        if line.startswith("# ") and not line.startswith("##"):
            continue

        # Phase: "## Phase N: <name>"
        if line.startswith("## "):
            heading = line[3:].strip()
            # Strip a leading "Phase N:" prefix if present.
            name = heading
            if ":" in heading:
                name = heading.split(":", 1)[1].strip()
            current_phase = {"name": name, "questions": []}
            pack["phases"].append(current_phase)
            current_q = None
            continue

        # Question id: "### <id>"
        if line.startswith("### "):
            qid = line[4:].strip()
            current_q = {
                "id": qid,
                "prompt": "",
                "required": False,
                "section": None,
                "default": None,
                "escalate": [],
            }
            if current_phase is None:
                current_phase = {"name": "", "questions": []}
                pack["phases"].append(current_phase)
            current_phase["questions"].append(current_q)
            continue

        # "- Key: value" field
        field = _split_field(line)
        if field is None:
            continue
        key, value = field
        key_l = key.lower()

        if current_q is not None:
            if key_l == "prompt":
                current_q["prompt"] = value
            elif key_l == "required":
                current_q["required"] = _parse_bool(value)
            elif key_l == "section":
                current_q["section"] = _strip_comment(value)
            elif key_l == "default":
                current_q["default"] = value
            elif key_l == "escalate":
                targets = [
                    t.strip()
                    for t in _strip_comment(value).split(",")
                    if t.strip()
                ]
                current_q["escalate"] = targets
        else:
            # Top-level metadata fields.
            if key_l == "version":
                pack["version"] = value
            elif key_l == "track":
                pack["track"] = value
            elif key_l == "description":
                pack["description"] = value

    return pack


def _all_questions(pack):
    for phase in pack["phases"]:
        for q in phase["questions"]:
            yield q


def validate_pack(pack):
    """Return a list of error strings (empty = valid)."""
    errors = []
    all_ids = {q["id"] for q in _all_questions(pack)}
    sections_present = set()

    for q in _all_questions(pack):
        if not q.get("prompt"):
            errors.append("question %r has an empty prompt" % q.get("id"))
        section = q.get("section")
        if section not in SECTION_IDS:
            errors.append(
                "question %r has unknown section: %r" % (q.get("id"), section)
            )
        else:
            sections_present.add(section)
        for target in q.get("escalate", []):
            if target not in all_ids:
                errors.append(
                    "question %r escalates to unknown question id: %r"
                    % (q.get("id"), target)
                )

    if "functional-requirements" not in sections_present:
        errors.append("no question maps to section functional-requirements")
    if "acceptance-criteria" not in sections_present:
        errors.append("no question maps to section acceptance-criteria")

    return errors


def assemble_prd(pack, answers):
    """Group answers under their PRD sections in canonical order.

    Returns {"sections": ordered mapping section_id -> [entries], "warnings": [...]}.
    Only answered sections are included. If a functional-requirements question
    is answered but no acceptance-criteria answer exists, a warning naming the
    offending question id is added.
    """
    by_section = {}
    functional_qids = []
    has_acceptance_answer = False

    for q in _all_questions(pack):
        qid = q["id"]
        if qid not in answers:
            continue
        text = answers[qid]
        section = q.get("section")
        if section not in SECTION_IDS:
            continue
        by_section.setdefault(section, []).append({"id": qid, "text": text})
        if section == "functional-requirements":
            functional_qids.append(qid)
        if section == "acceptance-criteria":
            has_acceptance_answer = True

    sections = {}
    for section in SECTION_ORDER:
        if section in by_section:
            sections[section] = by_section[section]

    warnings = []
    if not has_acceptance_answer:
        for qid in functional_qids:
            warnings.append(
                "functional requirement %r has no acceptance criterion" % qid
            )

    return {"sections": sections, "warnings": warnings}


def _cli(argv):
    if len(argv) >= 2 and argv[0] == "validate":
        pack = load_pack(argv[1])
        errors = validate_pack(pack)
        if errors:
            for e in errors:
                sys.stderr.write(e + "\n")
            return 1
        sys.stdout.write("valid\n")
        return 0
    sys.stderr.write("usage: checklist.py validate <pack>\n")
    return 2


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
