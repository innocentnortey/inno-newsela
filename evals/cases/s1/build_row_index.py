#!/usr/bin/env python3
"""Writes expected.row_index of s1-issued-row-index.json (NL-84, S1 intake golden).

Source: docs/data/samples/g6-u4-lesson-outline.json (the issued sample, public in-repo copy;
sha256 de8016ea1ea5ad9cd65241399e315259ca1ce6a6016c0fbab990dd06b9a3848a per the SYN-2 meta file).
Assumption encoded: row kind comes from the sample's row_kind; a lesson id is G6.U4.L<lesson number>;
flex rows are numbered by run of consecutive flex rows (FLEX-1a, FLEX-1b, FLEX-2a ...); arc headers and
the total row have no lesson id. The normalizer is never imported here, so this is an independent derivation.
Stdlib only, deterministic. Run from the repo root: python3 evals/cases/s1/build_row_index.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SAMPLE = ROOT / "docs/data/samples/g6-u4-lesson-outline.json"
OUT = Path(__file__).resolve().parent / "s1-issued-row-index.json"
KIND = {"lesson": "lesson", "flex_day": "flex_day", "arc_header": "arc_header", "total_row": "total"}


def main() -> None:
    rows = json.loads(SAMPLE.read_text(encoding="utf-8"))["rows"]
    entries = []
    flex_group = 0
    flex_index = 0
    prev_flex = False
    for r in rows:
        kind = KIND[r["row_kind"]]
        lesson_id = None
        if kind == "lesson":
            m = re.fullmatch(r"Lesson (\d+)", r["lesson_number"].strip())
            if m is None:
                raise SystemExit(f"unexpected lesson number at sheet row {r['sheet_row']}")
            lesson_id = f"G6.U4.L{m.group(1)}"
        elif kind == "flex_day":
            if not prev_flex:
                flex_group += 1
                flex_index = 0
            lesson_id = f"G6.U4.FLEX-{flex_group}{chr(97 + flex_index)}"
            flex_index += 1
        prev_flex = kind == "flex_day"
        entries.append({"row_number": int(r["sheet_row"]), "kind": kind, "lesson_id": lesson_id})
    doc = {
        "case_id": "s1-issued-row-index",
        "provenance": "issued",
        "source": "docs/data/samples/g6-u4-lesson-outline.json (issued G6 U4 sample; row index derived from the sample's own row kinds)",
        "guards": "every row of the issued sheet keeps its row number, kind and lesson id after normalization",
        "input": {"grid": "issued"},
        "expected": {"row_index": entries},
    }
    OUT.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")


main()
