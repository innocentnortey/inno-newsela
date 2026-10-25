"""Check whether one ticket is ready to be planned or built, from the project's own evidence.

Usage:
  python3 scripts/ticket_readiness.py check <ticket.json> --root <repo> [--json]

Prints READY or NOT READY, then one line per unmet condition. Exit 0 = ready, 1 = not ready,
2 = the ticket itself is unusable (bad JSON, unknown kind or phase, missing file).

Why it exists: zero-to-hero 2.0.0 (proposal `proposals/2026-10-25-concurrent-frontend.md`, APPROVED
2026-10-25) replaced "both tracks closed" with readiness **per ticket** (§3). Frontend work may run
alongside system design, so each ticket has to prove it rests only on things that are settled. This
script is that proof; its tests (`tests/test_ticket_readiness.py`) hold the proposal's §6 cases.

Ticket JSON:
  {"id": "FW-1", "kind": "backend|frontend|integration|foundation", "cons": ["CON-3"],
   "screens": ["SCR-4"], "depends_on": ["T-12"], "scope": ["design tokens"], "phase": "plan|execute"}

What each kind needs (proposal §3):
  backend      §6 gate ticked, and every CON it serves is `agreed` (it must list at least one CON).
  frontend     §6 gate ticked, every SCR it builds is signed (at least one), every CON it uses is
               `agreed`. It never needs UX-4 or UX-5: no full prototype before tickets.
  foundation   UX-2 direction picked, design tokens written, the readiness record complete, and a
               scope with nothing behaviour-dependent (proposal §4). It does NOT need §6.
  integration  phase `plan` (default): ready once depends_on names the tickets it joins (it should
               list at least one frontend and one backend ticket). Phase `execute`: every depends_on
               id is merged, and any CON it lists is `agreed`.

Evidence read from <repo> (tolerant of formatting, strict on meaning):
  PROJECT-CHECKLIST.md          Gate lines start `- **Gate:**`; ticked = contains ☑ (or `[x]`), and
                                every gate line in the section must be ticked. The §6 section is the
                                `## ` heading containing "Design" and "§6" or "6 ·". The UX-2 section
                                is the `## ` heading containing "UX-2".
  docs/design/DESIGN-DIRECTIONS.md  A line starting `**Picked:` also counts as the UX-2 pick.
  docs/contracts/INTERFACE.md   `## CON-N · title` cards, each with a `**Status:**` line holding
                                draft / proposed / agreed / changing. Only `agreed` counts.
  docs/ux/03-structure/SCREEN_SPECS.md  `## SCR-N …` headings with a `**Status:**` line; `signed`
                                (or `agreed`) counts.
  docs/plans/foundation-wave.md The FW readiness record: headings for Stack, Owned files, Scope,
                                Dependencies, Ticket specs and Review requirements.
  docs/design/design.md         Must have a heading containing "tokens".
  docs/plans/merged.txt         Convention for integration execute: the ids of merged tickets, one
                                per line (commas and spaces also separate; `#` starts a comment).
                                Whoever merges a ticket appends its id.
"""

import argparse
import json
import re
import sys
from pathlib import Path

KINDS = ("backend", "frontend", "integration", "foundation")
PHASES = ("plan", "execute")

CHECKLIST = "PROJECT-CHECKLIST.md"
DIRECTIONS = "docs/design/DESIGN-DIRECTIONS.md"
INTERFACE = "docs/contracts/INTERFACE.md"
SCREEN_SPECS = "docs/ux/03-structure/SCREEN_SPECS.md"
FOUNDATION = "docs/plans/foundation-wave.md"
DESIGN_MD = "docs/design/design.md"
MERGED = "docs/plans/merged.txt"

CON_STATUSES = ("draft", "proposed", "agreed", "changing")
SCR_STATUSES = ("draft", "proposed", "review", "signed", "agreed", "changing")

FOUNDATION_HEADINGS = (
    ("Stack", r"\bstack\b"),
    ("Owned files", r"\bowned\s+files?\b"),
    ("Scope", r"\bscope\b"),
    ("Dependencies", r"\bdependenc(y|ies)\b"),
    ("Ticket specs", r"\bticket\s+specs?\b"),
    ("Review requirements", r"\breview\s+requirements?\b"),
)

# Behaviour-dependent work that never belongs in the foundation wave (proposal §4).
OUT_OF_FOUNDATION = (
    ("permissions", r"\bpermissions?\b"),
    ("autosave", r"\bauto[\s-]?sav"),
    ("resumability", r"\bresum(e|es|ed|ing|able|ability|ption)\b"),
    ("booking", r"\bbook(ing|ings)\b"),
    ("job state", r"\bjob[\s-]*stat(e|es|us)\b"),
    ("data fetching", r"\bfetch"),
    ("backend errors", r"\bbackend[\s-]+errors?\b"),
    ("error recovery", r"\berror[\s-]+recovery\b"),
    ("real-time", r"\breal[\s-]*time\b"),
    ("collaboration", r"\bcollaborat"),
    ("auth", r"\bauth(?:\b|n|z|entic|ori[sz])"),
)


class TicketError(Exception):
    """The ticket cannot be judged at all (exit 2)."""


# ---------- evidence readers ----------

def read(root: Path, rel: str):
    p = root / rel
    return p.read_text(encoding="utf-8") if p.is_file() else None


def sections(text: str):
    """Yield (heading, body lines) for each `## ` section (### and deeper stay in the body)."""
    heading, body = None, []
    for line in text.splitlines():
        if re.match(r"^##\s", line):
            if heading is not None:
                yield heading, body
            heading, body = line[2:].strip(), []
        elif heading is not None:
            body.append(line)
    if heading is not None:
        yield heading, body


def gate_state(body):
    """None if the section has no gate line, else True when every gate line is ticked."""
    gates = [l for l in body if re.match(r"^\s*[-*]\s*\*\*Gate:?\*\*", l)]
    if not gates:
        return None
    return all(("☑" in g or re.search(r"\[[xX]\]", g)) and "☐" not in g for g in gates)


def is_s6_heading(h: str) -> bool:
    return bool(re.search(r"design", h, re.I) and re.search(r"§\s*6\b|(?<![\w-])6\s*·", h))


def find_gate(checklist: str, match) -> tuple:
    """(found section?, gate ticked?) for the first section whose heading matches."""
    for heading, body in sections(checklist):
        if match(heading):
            return True, bool(gate_state(body))
    return False, False


def card_statuses(text: str, prefix: str, allowed) -> dict:
    """Map `PREFIX-N` -> lower-case status word (or '' when the card has no readable status)."""
    out, current = {}, None
    for line in text.splitlines():
        m = re.match(rf"^#{{2,4}}\s*({prefix}-\d+)\b", line, re.I)
        if m:
            current = m.group(1).upper()
            out.setdefault(current, "")
            continue
        if re.match(r"^#{1,4}\s", line):
            current = None
            continue
        if current and not out[current] and "**status:**" in line.lower():
            after = line[line.lower().index("**status:**") + len("**status:**"):]
            words = re.findall(r"[a-z]+", after.lower())
            out[current] = next((w for w in words if w in allowed), words[0] if words else "")
    return out


def headings(text: str):
    return [re.sub(r"^#+\s*", "", l) for l in text.splitlines() if re.match(r"^#{1,6}\s", l)]


# ---------- conditions ----------

def need_s6(root: Path, unmet: list):
    checklist = read(root, CHECKLIST)
    if checklist is None:
        unmet.append(f"§6 gate: {CHECKLIST} not found, so the §6 Design gate cannot be confirmed ticked")
        return
    found, ticked = find_gate(checklist, is_s6_heading)
    if not found:
        unmet.append(f"§6 gate: no `## ` §6 Design section found in {CHECKLIST}")
    elif not ticked:
        unmet.append("§6 gate: the §6 Design gate is not ticked (needs ☑ on its `- **Gate:**` line)")


def need_cons(root: Path, cons, unmet: list, required: bool, kind: str):
    if not cons:
        if required:
            unmet.append(f"cons: a {kind} ticket must list the CON-N cards it relies on (none given)")
        return
    text = read(root, INTERFACE)
    if text is None:
        unmet.append(f"cons: {INTERFACE} not found, so {', '.join(cons)} cannot be confirmed agreed")
        return
    statuses = card_statuses(text, "CON", CON_STATUSES)
    for con in cons:
        status = statuses.get(con.upper())
        if status is None:
            unmet.append(f"{con}: no `## {con} · …` card in {INTERFACE}")
        elif status != "agreed":
            unmet.append(f"{con}: status is `{status or 'missing'}`, needs `agreed` in {INTERFACE}")


def need_screens(root: Path, screens, unmet: list):
    if not screens:
        unmet.append("screens: a frontend ticket must list the SCR-N specs it builds (none given)")
        return
    text = read(root, SCREEN_SPECS)
    if text is None:
        unmet.append(f"screens: {SCREEN_SPECS} not found, so {', '.join(screens)} cannot be confirmed signed")
        return
    statuses = card_statuses(text, "SCR", SCR_STATUSES)
    for scr in screens:
        status = statuses.get(scr.upper())
        if status is None:
            unmet.append(f"{scr}: no `## {scr} …` spec in {SCREEN_SPECS}")
        elif status not in ("signed", "agreed"):
            unmet.append(f"{scr}: status is `{status or 'missing'}`, needs `signed` in {SCREEN_SPECS}")


def need_ux2_pick(root: Path, unmet: list):
    checklist = read(root, CHECKLIST) or ""
    _, ticked = find_gate(checklist, lambda h: re.search(r"\bUX-2\b", h, re.I))
    directions = read(root, DIRECTIONS) or ""
    picked = any(l.strip().startswith("**Picked:") for l in directions.splitlines())
    if not (ticked or picked):
        unmet.append(f"UX-2: no direction picked (UX-2 gate unticked in {CHECKLIST} "
                     f"and no `**Picked:` line in {DIRECTIONS})")


def need_tokens(root: Path, unmet: list):
    text = read(root, DESIGN_MD)
    if text is None:
        unmet.append(f"tokens: {DESIGN_MD} not found, so design tokens are not written")
    elif not any(re.search(r"tokens?", h, re.I) for h in headings(text)):
        unmet.append(f"tokens: {DESIGN_MD} has no heading containing \"tokens\"")


def need_foundation_record(root: Path, unmet: list):
    text = read(root, FOUNDATION)
    if text is None:
        unmet.append(f"readiness record: {FOUNDATION} not found")
        return
    hs = headings(text)
    missing = [name for name, rx in FOUNDATION_HEADINGS if not any(re.search(rx, h, re.I) for h in hs)]
    if missing:
        unmet.append(f"readiness record: {FOUNDATION} is missing heading(s): {', '.join(missing)}")


def need_foundation_scope(scope, unmet: list):
    for item in scope:
        hits = [name for name, rx in OUT_OF_FOUNDATION if re.search(rx, item, re.I)]
        if hits:
            unmet.append(f"scope: \"{item}\" is behaviour-dependent ({', '.join(hits)}); "
                         "out of foundation scope, use the normal feature path")


def merged_ids(text: str) -> set:
    ids = set()
    for line in text.splitlines():
        line = line.split("#", 1)[0]
        ids.update(t.upper() for t in re.split(r"[\s,;]+", line) if t)
    return ids


def need_integration(root: Path, ticket: dict, phase: str, unmet: list):
    deps = ticket["depends_on"]
    if not deps:
        unmet.append("depends_on: an integration ticket must name the tickets it joins "
                     "(at least one frontend and one backend ticket)")
        return
    if phase == "plan":
        return
    text = read(root, MERGED)
    if text is None:
        unmet.append(f"merged: {MERGED} not found, so {', '.join(deps)} cannot be confirmed merged")
    else:
        done = merged_ids(text)
        waiting = [d for d in deps if d.upper() not in done]
        if waiting:
            unmet.append(f"merged: not yet merged ({MERGED}): {', '.join(waiting)}")
    need_cons(root, ticket["cons"], unmet, required=False, kind="integration")


# ---------- entry points ----------

def normalise(raw) -> dict:
    if not isinstance(raw, dict):
        raise TicketError("ticket JSON must be an object")
    kind = str(raw.get("kind", "")).strip().lower()
    if kind not in KINDS:
        raise TicketError(f"unknown kind `{raw.get('kind')}`; expected one of {', '.join(KINDS)}")
    phase = str(raw.get("phase") or "plan").strip().lower()
    if phase not in PHASES:
        raise TicketError(f"unknown phase `{raw.get('phase')}`; expected plan or execute")
    t = {"id": str(raw.get("id", "?")), "kind": kind, "phase": phase}
    for key in ("cons", "screens", "depends_on", "scope"):
        val = raw.get(key) or []
        if isinstance(val, str):
            val = [val]
        if not isinstance(val, list):
            raise TicketError(f"`{key}` must be a list")
        t[key] = [str(v).strip() for v in val if str(v).strip()]
    return t


def evaluate(ticket: dict, root: Path) -> dict:
    t = normalise(ticket)
    unmet: list = []
    if t["kind"] == "backend":
        need_s6(root, unmet)
        need_cons(root, t["cons"], unmet, required=True, kind="backend")
    elif t["kind"] == "frontend":
        need_s6(root, unmet)
        need_screens(root, t["screens"], unmet)
        need_cons(root, t["cons"], unmet, required=False, kind="frontend")
    elif t["kind"] == "foundation":
        need_ux2_pick(root, unmet)
        need_tokens(root, unmet)
        need_foundation_record(root, unmet)
        need_foundation_scope(t["scope"], unmet)
    else:
        need_integration(root, t, t["phase"], unmet)
    return {"id": t["id"], "kind": t["kind"], "phase": t["phase"], "ready": not unmet, "unmet": unmet}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Per-ticket readiness check (zero-to-hero 2.0.0 §3).")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check", help="check one ticket JSON file")
    c.add_argument("ticket")
    c.add_argument("--root", default=".", help="project repo root (default: current directory)")
    c.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args(argv)

    try:
        path = Path(args.ticket)
        if not path.is_file():
            raise TicketError(f"ticket file not found: {path}")
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise TicketError(f"ticket file is not valid JSON: {e}")
        root = Path(args.root)
        if not root.is_dir():
            raise TicketError(f"--root is not a directory: {root}")
        result = evaluate(raw, root)
    except TicketError as e:
        if args.json:
            print(json.dumps({"error": str(e)}))
        else:
            print(f"ERROR: {e}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        label = "READY" if result["ready"] else "NOT READY"
        print(f"{label} {result['id']} ({result['kind']}"
              f"{', ' + result['phase'] if result['kind'] == 'integration' else ''})")
        for line in result["unmet"]:
            print(f"  - {line}")
    return 0 if result["ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
