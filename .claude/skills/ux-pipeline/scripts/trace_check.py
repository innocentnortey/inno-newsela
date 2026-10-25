"""Check the UX traceability chain: REQ -> US -> FLOW -> SCR -> CON -> TEST.

Usage (from the project root):
  python3 -I <skill>/scripts/trace_check.py [--dir docs/ux] [--contracts docs/contracts]
                                            [--upto FLOW|SCR|CON|TEST]
                                            [--req-pattern REGEX] [--write docs/ux/05-verify/TRACEABILITY.md]

Where CON cards are read from (pilot v2, 2026-10-25):
- The canonical spec is docs/contracts/INTERFACE.md. By default --contracts is the "contracts" folder next to
  --dir (docs/ux -> docs/contracts); every *.md there is read along with --dir.
- Older projects keep CON cards in docs/ux/03-structure/UI_CONTRACTS.md; that file sits under --dir, so it is
  still read. If both define one CON, the definitions merge, and a WARN says the old file should be a pointer.

How IDs are read from the Markdown under --dir:
- An item is *defined* by a heading ("### US-3 · title") or by a table row whose first cell is the ID
  ("| SCR-2 | ... |"). Its block is the heading's section (to the next heading of the same or higher
  level) or the row. Several definitions of one ID merge.
- Every other ID mentioned inside a block is a *link*. Links count in both directions.
- In-scope requirements are the first column of the "## Requirement coverage" table in
  USER_STORIES.md. Requirement IDs match --req-pattern (default M-NN, SOL-NN, R-NN, REQ-NN).

Exit 1 on any FAIL. It checks structure only. Whether a story, flow or screen is *right* is the gate's job.
"""

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

KINDS = ["US", "FLOW", "SCR", "CON", "TEST"]
ID = re.compile(r"\b(US|FLOW|SCR|CON|TEST)-(\d+)\b")
HEAD = re.compile(r"^(#{1,6})\s+((?:US|FLOW|SCR|CON|TEST)-\d+)\b")
ROW = re.compile(r"^\|\s*((?:US|FLOW|SCR|CON|TEST)-\d+)\s*\|")
ANYHEAD = re.compile(r"^(#{1,6})\s")


def parse(files):
    blocks = defaultdict(str)
    for f in files:
        lines = f.read_text().splitlines()
        i = 0
        while i < len(lines):
            line = lines[i]
            h = HEAD.match(line)
            r = ROW.match(line)
            if h:
                level, key = len(h.group(1)), h.group(2)
                j = i + 1
                while j < len(lines):
                    m = ANYHEAD.match(lines[j])
                    if m and len(m.group(1)) <= level:
                        break
                    j += 1
                blocks[key] += "\n" + "\n".join(lines[i:j])
            elif r:
                blocks[r.group(1)] += "\n" + line
            i += 1
    return blocks


def in_scope_reqs(ux_dir: Path, req_re):
    found = sorted(ux_dir.rglob("USER_STORIES.md"))
    if not found:
        return []
    f = found[0]
    text = f.read_text()
    m = re.search(r"^##\s+Requirement coverage\s*$(.*?)(?=^##\s|\Z)", text, re.M | re.S)
    if not m:
        return []
    reqs = []
    for row in m.group(1).splitlines():
        cell = row.strip().strip("|").split("|")[0].strip() if row.strip().startswith("|") else ""
        if req_re.fullmatch(cell):
            reqs.append(cell)
    return reqs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="docs/ux")
    ap.add_argument("--contracts", help="canonical contract folder (default: <--dir>/../contracts)")
    ap.add_argument("--upto", default="TEST", choices=KINDS[1:])
    ap.add_argument("--req-pattern", default=r"(?:M|SOL|R|REQ)-\d+")
    ap.add_argument("--write")
    a = ap.parse_args()
    ux = Path(a.dir)
    if not ux.is_dir():
        print(f"FAIL no UX directory at {ux}")
        return 1
    req_re = re.compile(a.req_pattern)
    kinds = KINDS[: KINDS.index(a.upto) + 1]
    contracts = Path(a.contracts) if a.contracts else ux.parent / "contracts"
    ux_files = sorted(ux.rglob("*.md"))
    con_files = sorted(contracts.rglob("*.md")) if contracts.is_dir() else []
    if a.contracts and not contracts.is_dir():
        print(f"FAIL no contracts directory at {contracts}")
        return 1
    blocks = parse(ux_files + con_files)
    old_defs = set(parse([f for f in ux_files if f.name == "UI_CONTRACTS.md"]))
    new_defs = set(parse([f for f in con_files if f.name == "INTERFACE.md"]))
    defined = {k: v for k, v in blocks.items() if k.split("-")[0] in kinds}

    links = defaultdict(set)
    reqs_of = defaultdict(set)
    for key, text in defined.items():
        for m in ID.finditer(text):
            other = f"{m.group(1)}-{m.group(2)}"
            if other != key and m.group(1) in kinds:
                links[key].add(other)
                links[other].add(key)
        reqs_of[key] |= set(re.findall(rf"\b{a.req_pattern}\b", text))

    fails, warns = [], []
    for key in sorted((old_defs & new_defs), key=lambda k: (k.split("-")[0], int(k.split("-")[1]))):
        if key.startswith("CON-"):
            warns.append(f"{key} is defined in both UI_CONTRACTS.md and INTERFACE.md; make the old file a pointer")
    for key in sorted(links):
        if key not in defined:
            fails.append(f"{key} is referenced ({', '.join(sorted(links[key] & defined.keys())[:4])}) but never defined")

    def of(key, kind):
        return sorted(x for x in links[key] if x.startswith(kind + "-") and x in defined)

    ids = lambda kind: sorted((k for k in defined if k.startswith(kind + "-")), key=lambda s: int(s.split("-")[1]))

    # requirements -> stories
    scope = in_scope_reqs(ux, req_re)
    if not scope:
        fails.append("no in-scope requirements found (USER_STORIES.md → '## Requirement coverage' table)")
    covered = defaultdict(list)
    for us in ids("US"):
        if not reqs_of[us]:
            fails.append(f"{us} traces to no requirement")
        for r in reqs_of[us]:
            covered[r].append(us)
    for r in scope:
        if not covered[r]:
            fails.append(f"requirement {r} has no user story")

    chain = [("US", "FLOW"), ("FLOW", "SCR"), ("SCR", "CON"), ("CON", "SCR"), ("SCR", "TEST")]
    for src, dst in chain:
        if src not in kinds or dst not in kinds:
            continue
        for k in ids(src):
            if of(k, dst):
                continue
            if src == "SCR" and dst == "CON" and re.search(r"contracts?:\s*none", defined[k], re.I):
                continue
            fails.append(f"{k} has no linked {dst}")

    for kind in kinds:
        if not ids(kind):
            fails.append(f"no {kind} items defined")

    if a.write:
        rows = ["# UX-5 · Traceability", "", f"> Generated by trace_check.py (--upto {a.upto}). Do not edit by hand.", "",
                "| Requirement | Stories | Flows | Screens | Contracts | Tests |", "|---|---|---|---|---|---|"]
        for r in scope:
            us = covered[r]
            fl = sorted({f for u in us for f in of(u, "FLOW")})
            sc = sorted({s for f in fl for s in of(f, "SCR")} | {s for u in us for s in of(u, "SCR")})
            co = sorted({c for s in sc for c in of(s, "CON")})
            te = sorted({t for s in sc for t in of(s, "TEST")} | {t for f in fl for t in of(f, "TEST")})
            rows.append(f"| {r} | {', '.join(us) or '—'} | {', '.join(fl) or '—'} | {', '.join(sc) or '—'} | "
                        f"{', '.join(co) or '—'} | {', '.join(te) or '—'} |")
        Path(a.write).write_text("\n".join(rows) + "\n")

    for f in fails:
        print("FAIL", f)
    for w in warns:
        print("WARN", w)
    counts = ", ".join(f"{k}={len(ids(k))}" for k in kinds)
    src = f"contracts from {contracts}" if con_files else "contracts from --dir only (no docs/contracts/)"
    print(f"trace_check --upto {a.upto}: {len(fails)} fail(s); {len(scope)} requirements in scope; {counts}; {src}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
