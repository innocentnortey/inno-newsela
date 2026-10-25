#!/usr/bin/env python3
"""Writes the SYN-4+ safety-note recall set for S7 (NL-84) and syn4-manifest.json.

Synthetic. Source: HP-9 and docs/design/metrics-registry.md M-39 (recall over a synthetic set, labelled
synthetic with n; 3 paraphrases are a measured limit, not a floor). Successor to docs/data/scripts/build_samples.py
for SYN-4+. Assumption encoded: a teacher-addressed content warning leads with warn/alert/notify/remind/let and
contains a pattern phrase; the five warnings vary only the topic words. Text is invented and neutral, never copied
from the sheet. Stdlib only, no randomness: output is byte-identical between runs.
Run from the repo root: python3 evals/cases/s7/build_syn4.py
"""
import hashlib
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent

WARNINGS = [
    "Warn students that the poem about a flood may be upsetting for some readers.",
    "Alert the teacher team: the passage includes a content warning for a house fire.",
    "Notify families that the story about a lost pet is potentially upsetting.",
    "Remind students that the scene on the stormy night is disturbing and they may step out.",
    "Let students know the article about a school move may be distressing.",
]
DECOYS = [
    "Annotate the graphic organizer with two details from each paragraph.",
    "Remind students to bring their notebooks.",
    "Students discuss the sensitive topic of sharing space fairly.",
]
PARAPHRASES = [
    "Some readers may find the storm chapter hard to sit through; give them a quiet exit.",
    "Be aware that the closing scene is emotionally heavy for a number of children.",
    "Heads up: the story about a lost pet can hit close to home.",
]


def case(cid: str, guards: str, line: str, expected: dict) -> dict:
    return {
        "case_id": cid,
        "provenance": "synthetic",
        "source": "SYN-4+ (HP-9; metrics-registry M-39), written by evals/cases/s7/build_syn4.py",
        "guards": guards,
        "input": {"line": line},
        "expected": expected,
    }


def main() -> None:
    cases = []
    for i, line in enumerate(WARNINGS, 1):
        cases.append(case(f"s7-syn4-warning-{i}", "a teacher-addressed content warning is proposed as a safety note", line, {"proposed": True}))
    for i, line in enumerate(DECOYS, 1):
        cases.append(case(f"s7-syn4-decoy-{i}", "a look-alike line that is not a warning is not proposed", line, {"proposed": False}))
    for i, line in enumerate(PARAPHRASES, 1):
        cases.append(case(f"s7-syn4-paraphrase-{i}", "measurement only: a paraphrased warning's miss is a stated limit (M-39), never a failure", line, {"measurement_only": True}))
    hashes = {}
    for c in cases:
        text = json.dumps(c, indent=2) + "\n"
        (OUT / f"{c['case_id']}.json").write_text(text, encoding="utf-8")
        hashes[f"{c['case_id']}.json"] = hashlib.sha256(text.encode("utf-8")).hexdigest()
    combined = hashlib.sha256("".join(f"{k}:{v}\n" for k, v in sorted(hashes.items())).encode("utf-8")).hexdigest()
    manifest = {"generator": "evals/cases/s7/build_syn4.py", "n": len(cases), "label": "synthetic", "files": hashes, "sha256": combined}
    (OUT / "syn4-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


main()
