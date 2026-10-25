#!/usr/bin/env python3
"""Build docs/artifacts/YYYY-MM-DD-ticket-map.html: where Newsela's tickets stand and why each one matters.

    python3 docs/artifacts/_build/ticket-map/build_ticket_map.py --root . [--snapshot <json>] [--date YYYY-MM-DD]

Inputs: `snapshot.json` from export_snapshot.py (run on the VPS: tickets, GitLab states, merged list, names) and the
repo's own design files for the page's source links. Every number on the page is counted from the snapshot; the
product-step grouping is fixed below from DO-3 §4 (areas) and SCREEN_SPECS (screens). No model calls.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ISSUE_URL = "https://labs.gauntletai.com/innocentnortey/inno-newsela/-/issues/{}"
TEMPLATE = Path.home() / "Desktop/Nortorious-Technologies/.claude/skills/zero-to-hero/templates/visual-review-page.html"

# Product steps, in the order a unit moves through the tool. Text is plain; every ID cited is in the sources.
STEPS = [
    ("signin", "Sign in", "A3", "A reviewer and an approver each sign in, and each sees only what their role allows.",
     "Approval needs two different people. The system must refuse when someone tries to approve their own work.",
     "US-37", ["M-37"]),
    ("outline", "Bring in the unit outline", "A4",
     "A curriculum lead uploads the unit's Google Sheet. Each row is one lesson.",
     "Every lesson is written from this sheet. Problems are caught here, before any money is spent on writing.",
     "US-1–US-5", ["M-40"]),
    ("write", "Write the lessons", "A7–A10",
     "The lead starts a run. The tool asks Claude to write a draft for each lesson, inside a spend cap.",
     "This is the bulk work the brief asks for. A failed lesson is retried without paying twice for the same call.",
     "US-6–US-10, US-32", ["M-15", "M-16", "M-17", "M-31"]),
    ("check", "Check every draft", "A6",
     "Code checks each draft: are the quotes real, are the standards backed, is there a safety warning?",
     "Reviewers can only move fast if they trust what they are reading. The checks point them at the real problems.",
     "US-16", ["M-5", "M-7", "M-32", "M-38"]),
    ("edit", "Edit together", "A5, A11",
     "Reviewers open a lesson and edit it at the same time, like a shared document.",
     "Yjs is the library that merges two people's typing so nobody's edits are lost. Their time is counted fairly.",
     "US-13–US-23", ["M-18", "M-19"]),
    ("approve", "Review and approve", "A12",
     "A reviewer submits a lesson. A second person approves the exact version they read.",
     "This is the bar Newsela publishes at. The approved copy must be exactly what was reviewed.",
     "US-24–US-31", ["M-36", "M-37", "M-9", "M-35"]),
    ("measure", "Measure the north star", "A13",
     "The unit board shows what to review next and how many reviewer minutes each approved lesson took.",
     "Reviewer minutes per approved lesson is the north star (M-1). The board measures it honestly, with a guard "
     "against skimming (M-3).", "US-11, US-12, US-30", ["M-1", "M-3", "M-12"]),
]
SIDE = [
    ("extras", "Optional extras (the cut list)", "A15–A19",
     "AI rewrite help, prompt editing, export, standards coverage, an AI judge and a unit quality page.",
     "Useful, but each can be dropped in a fixed order (PD-17) if time runs short. The core journey never is.",
     "US-23, US-10, US-33–US-35", ["M-10", "M-14", "M-34"]),
    ("prove", "Prove it works", "A20, §9",
     "Tests on known answers, one full run of the real unit, experiments that fix what fails, and a 200-user load test.",
     "The demo makes claims about time, cost and quality. These tickets turn each claim into a measured number.",
     "US-36", ["M-30", "M-11", "M-22"]),
    ("foundations", "Foundations", "FW, A0–A2, A21",
     "The repo layout, database, data shapes, design system, health checks and backups.",
     "Nobody sees these directly. Every other ticket stands on them, so they were built first.", "—", []),
    ("deliver", "Deliver", "delivery",
     "Documents, the demo script, the video, the submission walk and the portal upload.",
     "This is what the reviewers at Newsela and Gauntlet actually receive.", "—", []),
]
AREA_STEP = {0: "foundations", 1: "foundations", 2: "foundations", 21: "foundations", 3: "signin", 4: "outline",
             5: "edit", 6: "check", 7: "write", 8: "write", 9: "write", 10: "write", 11: "edit", 12: "approve",
             13: "measure", 15: "extras", 16: "extras", 17: "extras", 18: "extras", 19: "extras", 20: "prove"}
SCR_STEP = {1: "signin", 2: "outline", 3: "outline", 4: "outline", 5: "write", 6: "write", 7: "write", 17: "write",
            8: "measure", 9: "edit", 10: "edit", 11: "edit", 12: "edit", 14: "approve", 15: "approve", 16: "approve",
            13: "extras", 18: "extras", 19: "extras", 20: "extras", 21: "extras"}
# Tickets the area/screen rule would misplace: verification across every screen, and the screen harness.
OVERRIDE = {"NL-24": "foundations", "NL-05": "prove", "NL-126": "prove", "NL-133": "prove"}
# Your tickets in plain words (the titles use build-plan wording). Source: docs/plans/tickets/<id>.md.
YOURS = {
    "NL-02": "Check that the Anthropic and OpenRouter keys work in the shared workspace env",
    "NL-03": "Put the narration voice key in .demo/.env for the demo video",
    "NL-122": "Label about 30 activity and standard pairs, so the AI judge can be measured against you",
    "NL-123": "Do two timed review sessions (reviewer and approver accounts) and rate the demo lessons",
    "NL-124": "Review about 5 lessons with errors Claude planted, through the normal review flow",
    "NL-133": "Walk the finished app and give the UX-5b acceptance sign-off",
    "NL-138": "Record the demo video: the product in under 5 minutes, then the decisions",
    "NL-143": "Upload the submission on the Gauntlet portal",
}
CRITICAL = "NL-01 NL-09 NL-12 NL-29 NL-79 NL-112 NL-120 NL-128 NL-134 NL-137 NL-138 NL-141 NL-143".split()
KIND = {"backend": "Backend", "frontend": "Screen", "integration": "Join", "foundation": "Design system", "n/a": "Setup"}
LANE = {"build-loop": "Build loop", "direct": "Direct", "human": "You", "spike": "Spike"}
STATUS = {"done": ("Merged", "done"), "ready": ("Can start", "ready"), "waiting": ("Waiting on others", "waiting"),
          "you": ("Your action", "you")}
E = html.escape


def step_of(t: dict) -> str:
    area = str(t.get("area") or "")
    if t["id"] in OVERRIDE:
        return OVERRIDE[t["id"]]
    if t["id"].startswith("FW"):
        return "foundations"
    if "delivery" in area:
        return "deliver"
    if "§9" in area:
        return "prove"
    nums = [int(x) for x in re.findall(r"A(\d+)", area) if x != "14"]
    if nums:
        return AREA_STEP.get(nums[0], "foundations")
    for s in t.get("screens") or []:
        m = re.search(r"(\d+)", s)
        if m and int(m.group(1)) in SCR_STEP:
            return SCR_STEP[int(m.group(1))]
    return "foundations"


def short(title: str, n: int = 96) -> str:
    t = re.sub(r"[`*]", "", title)
    return t if len(t) <= n else t[: n - 1].rsplit(" ", 1)[0] + "…"


def status_of(t: dict, merged: set[str]) -> str:
    if t["id"] in merged:
        return "done"
    if t.get("lane") == "human":
        return "you"
    deps = [d for d in t.get("depends_on") or [] if re.match(r"^(NL|FW)-\d+$", d)]
    return "ready" if all(d in merged for d in deps) else "waiting"


def chip(t: dict, st: str) -> str:
    label, cls = STATUS[st]
    iid = t.get("gitlab_iid")
    inner = f'<b>{E(t["id"])}</b> {E(short(t["title"], 60))}'
    link = f'<a href="{ISSUE_URL.format(iid)}">{inner}</a>' if iid else inner
    return f'<li class="tk {cls}" title="{E(label)}"><span class="dot" aria-hidden="true"></span>{link}<span class="sr"> ({E(label)})</span></li>'


def bar(done: int, total: int, label: str) -> str:
    pct = round(100 * done / total) if total else 0
    return (f'<div class="bar" role="img" aria-label="{E(label)}: {done} of {total} merged">'
            f'<span style="width:{pct}%"></span></div><p class="barlabel">{done} of {total} merged ({pct}%)</p>')


def svg_waves(waves: dict) -> str:
    w, h, top, rowh = 980, 12 + 34 * len(waves), 6, 34
    out = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-labelledby="wv-t wv-d"><title id="wv-t">Progress by wave</title>'
           '<desc id="wv-d">One bar per wave. The filled part is merged tickets; the hatched part can start now; '
           'the rest waits on earlier tickets or on you.</desc>'
           '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
           '<rect width="6" height="6" class="hatch-bg"/><line x1="0" y1="0" x2="0" y2="6" class="hatch-line"/></pattern></defs>']
    maxn = max(v["total"] for v in waves.values())
    scale = (w - 400) / maxn
    for i, (k, v) in enumerate(waves.items()):
        y = top + i * rowh
        out.append(f'<text x="0" y="{y + 15}" class="strong">Wave {k}</text>')
        out.append(f'<text x="64" y="{y + 15}" class="small">{v["total"]} tickets</text>')
        x = 150
        for part, cls in (("done", "seg-done"), ("ready", "seg-ready"), ("you", "seg-you"), ("waiting", "seg-wait")):
            n = v[part]
            if n:
                out.append(f'<rect x="{x:.1f}" y="{y}" width="{n * scale:.1f}" height="20" rx="3" class="{cls}"/>')
                x += n * scale
        note = f'{v["done"]} merged' + (f', {v["ready"]} can start' if v["ready"] else "") + (f', {v["you"]} for you' if v["you"] else "")
        out.append(f'<text x="{x + 8:.1f}" y="{y + 15}" class="small">{E(note)}</text>')
    out.append("</svg>")
    return "".join(out)


def svg_journey(counts: dict) -> str:
    w, bw, gap, y = 1040, 132, 16, 8
    out = [f'<svg viewBox="0 0 {w} 150" role="img" aria-labelledby="jr-t jr-d"><title id="jr-t">The product journey and how much of each step is built</title>'
           '<desc id="jr-d">Seven steps from sign-in to the north star, left to right. Under each step, a bar shows the share of its tickets merged.</desc>'
           '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head" d="M0,0 L10,5 L0,10 z"/></marker></defs>']
    for i, (key, name, *_rest) in enumerate(STEPS):
        x = 8 + i * (bw + gap)
        c = counts[key]
        pct = c["done"] / c["total"] if c["total"] else 0
        out.append(f'<rect class="node {"fact" if pct == 1 else "proposal" if pct == 0 else "decision"}" x="{x}" y="{y}" width="{bw}" height="96" rx="8"/>')
        words, line = name.split(), ""
        lines = []
        for wd in words:
            if len(line + " " + wd) > 16:
                lines.append(line)
                line = wd
            else:
                line = (line + " " + wd).strip()
        lines.append(line)
        for j, ln in enumerate(lines):
            out.append(f'<text x="{x + 10}" y="{y + 22 + j * 17}" class="strong">{E(ln)}</text>')
        out.append(f'<text x="{x + 10}" y="{y + 76}" class="small">{c["done"]}/{c["total"]} merged</text>')
        out.append(f'<rect x="{x + 10}" y="{y + 82}" width="{bw - 20}" height="6" rx="3" class="track"/>'
                   f'<rect x="{x + 10}" y="{y + 82}" width="{(bw - 20) * pct:.1f}" height="6" rx="3" class="fill"/>')
        if i < len(STEPS) - 1:
            out.append(f'<path class="arrow" d="M{x + bw + 1},{y + 48} L{x + bw + gap - 1},{y + 48}" marker-end="url(#ah)"/>')
    out.append(f'<text x="8" y="138" class="small">Solid outline: every ticket merged · plain: some merged · dashed: none merged yet.</text></svg>')
    return "".join(out)


def svg_critical(tmap: dict, merged: set) -> str:
    bw, gap = 112, 14
    w = 8 + len(CRITICAL) * (bw + gap)
    out = [f'<svg viewBox="0 0 {w} 122" role="img" aria-labelledby="cp-t cp-d"><title id="cp-t">The critical path, 13 tickets</title>'
           '<desc id="cp-d">The longest chain of tickets that depend on each other. Filled boxes are merged.</desc>'
           '<defs><marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head" d="M0,0 L10,5 L0,10 z"/></marker></defs>']
    for i, tid in enumerate(CRITICAL):
        x = 8 + i * (bw + gap)
        done = tid in merged
        t = tmap.get(tid, {"title": "", "wave": "?"})
        out.append(f'<rect x="{x}" y="20" width="{bw}" height="92" rx="8" class="{"cp-done" if done else "cp-open"}"/>')
        out.append(f'<text x="{x + 10}" y="42" class="strong {"on-fill" if done else ""}">{tid}{" ✓" if done else ""}</text>')
        out.append(f'<text x="{x + 10}" y="60" class="small {"on-fill" if done else ""}">Wave {t["wave"]}</text>')
        words = short(re.sub(r"^[a-zA-Z0-9 /-]+:\s*", "", t["title"]), 40).split()
        lines, line = [], ""
        for wd in words:
            if len(line + " " + wd) > 17:
                lines.append(line)
                line = wd
            else:
                line = (line + " " + wd).strip()
        lines.append(line)
        for j, ln in enumerate(lines[:2]):
            out.append(f'<text x="{x + 10}" y="{80 + j * 15}" class="small {"on-fill" if done else ""}">{E(ln)}</text>')
        if i < len(CRITICAL) - 1:
            out.append(f'<path class="arrow" d="M{x + bw + 1},66 L{x + bw + gap - 1},66" marker-end="url(#ah2)"/>')
    out.append("</svg>")
    return "".join(out)


EXTRA_CSS = """
.status-banner.info{background:var(--fact-bg);border-color:var(--fact)} .status-banner.info strong{color:var(--fact)}
.bar{height:10px;background:var(--surface-2);border-radius:999px;overflow:hidden;border:1px solid var(--line)}
.bar span{display:block;height:100%;background:var(--fact)}
.barlabel{font-size:13px;color:var(--muted);margin:4px 0 var(--space-2)}
.stat{font-size:clamp(28px,5vw,40px);font-weight:750;line-height:1;margin:var(--space-2) 0;font-variant-numeric:tabular-nums}
ul.tks{list-style:none;margin:var(--space-2) 0 0;padding:0;display:grid;gap:4px}
.tk{display:flex;gap:8px;align-items:baseline;font-size:14px;line-height:1.35}
.tk a{color:var(--ink);text-decoration:none}.tk a:hover{text-decoration:underline}
.tk .dot{flex:none;width:10px;height:10px;border-radius:2px;border:2px solid var(--muted);transform:translateY(1px)}
.tk.done .dot{background:var(--fact);border-color:var(--fact);border-radius:50%}
.tk.ready .dot{border-color:var(--decision);background:repeating-linear-gradient(45deg,var(--decision) 0 2px,transparent 2px 4px)}
.tk.you .dot{border-color:var(--awaiting);background:var(--awaiting);transform:translateY(1px) rotate(45deg)}
.tk.waiting .dot{border-style:dashed}
.tk.done{color:var(--muted)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.keyrow{display:flex;flex-wrap:wrap;gap:var(--space-2) var(--space-4);font-size:14px;margin:var(--space-2) 0 var(--space-3);padding:0;list-style:none}
.keyrow .tk{font-size:14px}
details.more{margin-top:var(--space-2)} details.more summary{cursor:pointer;color:var(--accent);font-size:14px}
.why{font:16px/1.55 var(--font-body);margin:0 0 var(--space-2)}
.moment{font-size:14px;color:var(--muted);margin:0 0 var(--space-2)}
svg .seg-done{fill:var(--fact)} svg .seg-ready{fill:url(#hatch)} svg .seg-you{fill:var(--awaiting)} svg .seg-wait{fill:var(--surface-2);stroke:var(--line)}
svg .hatch-bg{fill:var(--decision-bg)} svg .hatch-line{stroke:var(--decision);stroke-width:2}
svg .track{fill:var(--surface-2)} svg .fill{fill:var(--fact)}
svg .cp-done{fill:var(--fact);stroke:var(--fact)} svg .cp-open{fill:var(--surface);stroke:var(--line);stroke-width:1.5;stroke-dasharray:5 3}
svg .on-fill{fill:var(--surface)}
.filters{display:flex;flex-wrap:wrap;gap:var(--space-2) var(--space-3);align-items:end;margin:var(--space-3) 0}
.filters label{display:grid;gap:4px;font-size:13px;font-weight:600}
.filters select,.filters input{font:15px var(--font-ui);padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);min-height:44px}
.filters select:focus-visible,.filters input:focus-visible{outline:3px solid var(--focus);outline-offset:1px}
#count{font-size:14px;color:var(--muted)}
td.st-cell{white-space:nowrap}
.pill{display:inline-block;font-size:12px;font-weight:700;padding:1px 8px;border-radius:999px;border:1.5px solid currentColor}
.pill.done{color:var(--fact);background:var(--fact-bg)} .pill.ready{color:var(--decision);background:var(--decision-bg)}
.pill.you{color:var(--awaiting);background:var(--awaiting-bg)} .pill.waiting{color:var(--unknown);background:var(--unknown-bg);border-style:dashed}
.example{display:grid;gap:var(--space-3);grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--snapshot", default=None)
    ap.add_argument("--date", default=dt.date.today().isoformat())
    a = ap.parse_args()
    root = Path(a.root).resolve()
    snap_path = Path(a.snapshot) if a.snapshot else Path(__file__).with_name("snapshot.json")
    d = json.loads(snap_path.read_text())
    tickets = d["tickets"]
    tmap = {t["id"]: t for t in tickets}
    merged = set(d["merged"])
    issues = {i["iid"]: i for i in d["issues"]}
    for t in tickets:
        t["_st"] = status_of(t, merged)
        t["_step"] = step_of(t)
        t["_issue"] = issues.get(t.get("gitlab_iid"), {}).get("state", "?")
    dependants = defaultdict(list)
    for t in tickets:
        for dep in t.get("depends_on") or []:
            dependants[dep].append(t["id"])

    total, done = len(tickets), sum(t["_st"] == "done" for t in tickets)
    mismatched = [t["id"] for t in tickets if (t["_st"] == "done") != (t["_issue"] == "closed")]
    st_count = Counter(t["_st"] for t in tickets)
    waves: dict = {}
    for k in sorted({int(t["wave"]) for t in tickets}):
        ws = [t for t in tickets if int(t["wave"]) == k]
        waves[k] = {"total": len(ws), **{s: sum(t["_st"] == s for t in ws) for s in STATUS}}
    full_waves = [k for k, v in waves.items() if v["done"] == v["total"]]
    cp_done = sum(c in merged for c in CRITICAL)
    next_cp = next((c for c in CRITICAL if c not in merged), None)
    counts = {}
    for key, *_ in STEPS + SIDE:
        ts = [t for t in tickets if t["_step"] == key]
        counts[key] = {"total": len(ts), "done": sum(t["_st"] == "done" for t in ts)}
    lane_c = Counter(t["lane"] for t in tickets)
    kind_c = Counter(t["kind"] for t in tickets)
    sec = sum(bool(t.get("risk_security")) for t in tickets)
    cut = sum(t.get("cuttable") not in (None, "", False) for t in tickets)
    head_sha, head_time = (d.get("head") or "? ?").split(" ", 1)
    head_time = head_time.replace("T", " ").replace("+00:00", " UTC")

    tpl = TEMPLATE.read_text()
    css = tpl[tpl.index("<style>") + 7: tpl.index("</style>")]
    sources = ["docs/plans/slice-plan.md", "docs/plans/merged.txt", "docs/plans/tickets.md",
               "docs/design/code-design.md", "docs/design/metrics-registry.md", "docs/ux/03-structure/SCREEN_SPECS.md"]
    metas = "\n".join(f'<meta name="review-source" content="{s}|0">' for s in sources if (root / s).exists())
    src_links = " · ".join(f'<a href="../../{s}"><code>{s}</code></a> <code data-sha-for="{s}">0</code>'
                           for s in sources if (root / s).exists())

    def step_card(key, name, areas, moment, why, us, mets):
        ts = sorted([t for t in tickets if t["_step"] == key], key=lambda t: (t["_st"] != "you", int(t["wave"]), t["id"]))
        c = counts[key]
        status = "fact"
        met = ", ".join(f'{m} {E(d["metrics"].get(m, ""))}' for m in mets)
        chips = "".join(chip(t, t["_st"]) for t in ts)
        kinds = Counter(KIND.get(t["kind"], t["kind"]) for t in ts)
        kind_line = " · ".join(f"{n} {k.lower()}" for k, n in kinds.most_common())
        return (f'<article class="card" data-status="{status}" id="step-{key}"><h3>{E(name)} <span class="st fact">Fact</span></h3>'
                f'<p class="moment"><strong>In the product:</strong> {E(moment)}</p>'
                f'<p class="why">{E(why)}</p>'
                f'<p class="src">Code areas {E(areas)} · stories {E(us)}' + (f' · metrics {met}' if met else "") + '</p>'
                + bar(c["done"], c["total"], name) +
                f'<p class="src">{c["total"]} tickets: {E(kind_line)}</p>'
                f'<details class="more"{" open" if c["total"] <= 8 else ""}><summary>Show the {c["total"]} tickets</summary><ul class="tks">{chips}</ul></details></article>')

    yours = sorted([t for t in tickets if t["_st"] == "you"], key=lambda t: int(t["wave"]))
    you_cards = []
    for t in yours:
        blocks = dependants.get(t["id"], [])
        model_runs = any(b in ("NL-109", "NL-112") for b in blocks)
        on_path = any(b in CRITICAL for b in blocks)
        you_cards.append(
            f'<article class="card" data-status="awaiting"><h3>{E(t["id"])} · wave {t["wave"]} <span class="st awaiting">Your action</span></h3>'
            f'<p class="big">{E(YOURS.get(t["id"], short(t["title"], 120)))}</p>'
            + (f'<p><strong>It unblocks:</strong> {", ".join(E(b) + (" (critical path)" if b in CRITICAL else "") for b in blocks)}.</p>' if blocks else "<p>Nothing else waits on it.</p>")
            + ('<p><strong>Do this one early.</strong> The three-lesson trial and the full run of the real unit wait on it.</p>' if model_runs
               else '<p>A critical-path ticket waits on it, so a late answer delays the finish.</p>' if on_path else "")
            + f'<p class="src"><a href="{ISSUE_URL.format(t.get("gitlab_iid"))}">GitLab issue #{t.get("gitlab_iid")}</a> has the exact steps · '
              f'source <code>docs/plans/tickets/{E(t["id"])}.md</code></p></article>')

    ready = sorted([t for t in tickets if t["_st"] == "ready"], key=lambda t: (t["id"] not in CRITICAL, int(t["wave"]), t["id"]))
    rows = []
    step_names = {k: n for k, n, *_ in STEPS + SIDE}
    for t in sorted(tickets, key=lambda t: (int(t["wave"]), t["id"])):
        label, cls = STATUS[t["_st"]]
        deps = ", ".join(x for x in t.get("depends_on") or [] if re.match(r"^(NL|FW)-\d+$", x)) or "—"
        rows.append(f'<tr data-st="{cls}" data-step="{t["_step"]}" data-wave="{t["wave"]}">'
                    f'<td><a href="{ISSUE_URL.format(t.get("gitlab_iid"))}">{E(t["id"])}</a></td>'
                    f'<td>{E(short(t["title"], 110))}' + (' <span class="tag">security</span>' if t.get("risk_security") else "")
                    + (f' <span class="tag">cut #{E(str(t["cuttable"]))}</span>' if t.get("cuttable") not in (None, "", False) else "") +
                    f'</td><td>{E(step_names[t["_step"]])}</td><td>{E(KIND.get(t["kind"], t["kind"]))}</td>'
                    f'<td>{E(LANE.get(t["lane"], t["lane"]))}</td><td>{t["wave"]}</td>'
                    f'<td class="st-cell"><span class="pill {cls}">{E(label)}</span></td><td>{E(deps)}</td></tr>')

    ex = [tmap.get(x) for x in ("NL-27", "NL-58", "NL-95")]
    ex_cards = ""
    if all(ex):
        for t, what in zip(ex, ("The backend: the code that starts a run and records it. It is tested with stand-ins "
                                "(\"doubles\") for the parts it calls, so it never waits for the screen.",
                                "The screen: the Start run dialog. It is built against a mock server that answers exactly "
                                "as the agreed contract says, so it never waits for the backend.",
                                "The join: the real dialog against the real backend. It runs only after both halves are "
                                "merged, and re-runs the screen's checks for real.")):
            label, cls = STATUS[t["_st"]]
            ex_cards += (f'<article class="card" data-status="fact"><h3>{E(t["id"])} · {E(KIND[t["kind"]])} '
                         f'<span class="pill {cls}">{E(label)}</span></h3><p>{E(what)}</p>'
                         f'<p class="src">Wave {t["wave"]} · depends on {E(", ".join(t.get("depends_on") or []) or "—")}</p></article>')

    nl24 = tmap.get("NL-24")
    nl24_note = ""
    if nl24 and nl24["_st"] != "done":
        nl24_note = (f'<p><strong>One ticket to watch:</strong> <code>NL-24</code> (the screen harness: the generated API client, '
                     f'the mock server and the app frame) is still open in wave 3, and {len(dependants.get("NL-24", []))} '
                     f'tickets wait on it, most of them wave 4 screens.</p>')

    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Newsela — ticket map</title>
<meta name="review-stage" content="Zero-to-hero Stage 8 · Build (ticket status, information only)">
<meta name="review-status" content="SNAPSHOT — information only; nothing on this page asks for approval">
<meta name="review-date" content="{a.date}">
{metas}
<style>{css}{EXTRA_CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
<p class="kicker">Newsela Lesson Studio · Stage 8 build · ticket map · local file</p>
<h1>Where the 147 tickets stand, and why each one matters</h1>
<div class="status-banner info" role="status"><span class="st fact">Snapshot</span><div><strong>Information only.</strong>
This page counts the repo at commit <code>{E(head_sha)}</code> ({E(head_time)}). The build keeps moving, so rebuild it for fresh numbers.
Nothing here asks for approval. Your own actions are listed in section 5.</div></div>
<dl class="meta"><dt>Built</dt><dd>{a.date}, from <code>docs/artifacts/_build/ticket-map/</code></dd>
<dt>Sources</dt><dd>{src_links}; GitLab issue states for project 2346</dd>
<dt>Refresh</dt><dd><code>ssh claude-vultr 'cd /home/linuxuser/workspaces/inno-newsela &amp;&amp; python3 -' &lt; docs/artifacts/_build/ticket-map/export_snapshot.py &gt; docs/artifacts/_build/ticket-map/snapshot.json</code>, then <code>python3 docs/artifacts/_build/ticket-map/build_ticket_map.py --root .</code></dd></dl>
<ul class="legend" data-legend aria-label="Status legend">
<li><span class="st fact" data-legend-item="fact">Fact</span> counted from the repo or GitLab</li>
<li><span class="st decision" data-legend-item="decision">Your decision</span> a recorded decision (PD-N)</li>
<li><span class="st proposal" data-legend-item="proposal">Proposal</span> Claude's plan, not settled</li>
<li><span class="st unknown" data-legend-item="unknown">Unknown</span> not known yet</li>
<li><span class="st awaiting" data-legend-item="awaiting">Your action</span> something only you can do</li></ul>
</div></header>
<main id="main" class="wrap">

<section aria-labelledby="story-h" data-visual="story">
<h2 id="story-h">1 · The story in one minute</h2>
<p class="lede">Newsela needs about 40 lessons for each unit of its new California reading course. Today a writer drafts each one and a
reviewer checks it. Our tool reads the unit's outline sheet and has Claude write every lesson. Then code checks each draft, two
reviewers edit it together, and a second person approves the exact version they read.</p>
<p class="lede">Success is one number, the <strong>north star</strong>: reviewer minutes per approved lesson (M-1). Fewer minutes means
more lessons for the same staff. A guard (M-3) catches anyone who gets there by skimming.</p>
<p>A <strong>ticket</strong> is one small, testable piece of that tool. The plan cut the product into {total} of them. It put them
in {len(waves)} <strong>waves</strong>. A wave is a group that can be built side by side, because no ticket in it needs another
from the same wave. The rest of this page shows how far each part has come.</p>
</section>

<section aria-labelledby="sum-h" data-visual="summary">
<h2 id="sum-h">2 · At a glance</h2>
<div class="grid">
<article class="card" data-status="fact"><h3>Merged <span class="st fact">Fact</span></h3><p class="stat">{done} / {total}</p>{bar(done, total, "All tickets")}
<p class="src">{st_count["ready"]} can start now · {st_count["waiting"]} wait on other tickets · {st_count["you"]} are yours. Every merged ticket's GitLab issue is closed{"" if not mismatched else " except " + ", ".join(mismatched)}.</p></article>
<article class="card" data-status="fact"><h3>Waves finished <span class="st fact">Fact</span></h3><p class="stat">{", ".join("W" + str(k) for k in full_waves) or "none"}</p>
<p class="src">Wave 3 is at {waves.get(3, {}).get("done", 0)} of {waves.get(3, {}).get("total", 0)}. Wave 4 is the widest wave: {waves.get(4, {}).get("total", 0)} tickets, most of them screens.</p></article>
<article class="card" data-status="fact"><h3>Critical path <span class="st fact">Fact</span></h3><p class="stat">{cp_done} / {len(CRITICAL)}</p>
<p class="src">The longest chain of tickets that wait on each other. Next on it: <code>{E(next_cp or "—")}</code>. See section 6.</p></article>
<article class="card" data-status="awaiting"><h3>Yours <span class="st awaiting">Your action</span></h3><p class="stat">{st_count["you"]}</p>
<p class="src">Keys, labels, timed reviews, sign-off, the video and the upload. The earliest one, <code>NL-02</code>, unblocks the real model runs.</p></article>
</div>
<figure><p class="scroll-hint">Chart: swipe sideways. The numbers are also in the table in section 8.</p>
<div class="scroll" tabindex="0" aria-label="Wave progress chart, scrolls sideways">{svg_waves(waves)}</div>
<figcaption>Filled = merged · hatched = can start now · red = yours · grey = waiting on earlier tickets.</figcaption></figure>
{nl24_note}
</section>

<section aria-labelledby="how-h">
<h2 id="how-h">3 · How one feature becomes tickets</h2>
<p class="section-sub">Take one thing a curriculum lead does: <em>start a run</em>, which writes a unit's lessons. The plan splits it into
three tickets, so the screen and the backend are built at the same time by different agents. They agree in advance on a
<strong>contract</strong>: a written promise of what the screen sends and what the backend answers (here CON-5 in
<code>docs/contracts/INTERFACE.md</code>).</p>
<div class="example">{ex_cards}</div>
<div class="grid three" style="margin-top:var(--space-3)">
<article class="card" data-status="fact"><h3>Four kinds of ticket <span class="st fact">Fact</span></h3><ul class="tight">
<li><strong>Backend</strong> ({kind_c.get("backend", 0)}): logic, storage, model calls.</li>
<li><strong>Screen</strong> ({kind_c.get("frontend", 0)}): one screen spec, built against the mock.</li>
<li><strong>Join</strong> ({kind_c.get("integration", 0)}): a screen and its backend, wired together and re-checked. Docs, evals and delivery work sit here too.</li>
<li><strong>Design system</strong> ({kind_c.get("foundation", 0)}): the shared look, tokens and basic parts every screen uses.</li>{f'<li><strong>Setup</strong> ({kind_c["n/a"]}).</li>' if kind_c.get("n/a") else ""}</ul></article>
<article class="card" data-status="fact"><h3>Four lanes: who does it <span class="st fact">Fact</span></h3><ul class="tight">
<li><strong>Build loop</strong> ({lane_c.get("build-loop", 0)}): plan, build, test, review, merge.</li>
<li><strong>Direct</strong> ({lane_c.get("direct", 0)}): documents. One agent writes them, with no code gates.</li>
<li><strong>You</strong> ({lane_c.get("human", 0)}): only you can do it.</li>
<li><strong>Spike</strong> ({lane_c.get("spike", 0)}): the three experiments already ran at Stage 5.</li></ul>
<p class="src">Rule: <code>.claude/rules/ticket-lanes.md</code></p></article>
<article class="card" data-status="decision"><h3>Two safety labels <span class="st decision">Your decision</span></h3><ul class="tight">
<li><strong>Security</strong> ({sec}): a bug here could leak data or let the wrong person act. Tests are written before the code, and a security review runs at the wave merge.</li>
<li><strong>Cuttable</strong> ({cut}): dropped in a fixed order if time runs short (PD-17). Cuttable work starts only after the core work of its wave.</li></ul>
<p class="src">PD-17 cut order · PD-32 standing authorization · <code>build-loop-test-scope.md</code></p></article>
</div>
</section>

<section aria-labelledby="jr-h">
<h2 id="jr-h">4 · The product journey, ticket by ticket</h2>
<p class="section-sub">Each ticket below sits on the step of the journey it builds. Each step says who is using the tool at that
moment, and why that step matters to the north star.</p>
<figure><p class="scroll-hint">Diagram: swipe sideways. The cards below say the same thing.</p>
<div class="scroll" tabindex="0" aria-label="Journey diagram, scrolls sideways">{svg_journey(counts)}</div>
<figcaption>The seven steps a unit moves through. Foundations, proof and delivery support every step (below).</figcaption></figure>
<ul class="keyrow" aria-label="Ticket marker key"><li class="tk done"><span class="dot"></span>Merged</li><li class="tk ready"><span class="dot"></span>Can start now</li>
<li class="tk waiting"><span class="dot"></span>Waiting on other tickets</li><li class="tk you"><span class="dot"></span>Your action</li></ul>
<div class="grid two">{"".join(step_card(*s) for s in STEPS)}</div>
<h3 style="margin-top:var(--space-4)">Around the journey</h3>
<div class="grid two">{"".join(step_card(*s) for s in SIDE)}</div>
</section>

<section aria-labelledby="you-h">
<h2 id="you-h">5 · What waits on you</h2>
<p class="section-sub">These {len(yours)} tickets need a person: a key only you hold, labels only you can give, real timed reviews, the
sign-off, the video and the upload. Automated checks never stand in for them. Each GitLab issue has the exact steps.</p>
<div class="grid two">{"".join(you_cards)}</div>
</section>

<section aria-labelledby="cp-h">
<h2 id="cp-h">6 · The critical path</h2>
<p class="section-sub">These 13 tickets each wait on the one before, from the repo layout to the portal upload. Nothing can make
this chain shorter, so it sets the finish date. The full run of the real unit (<code>NL-112</code>) is its biggest single step.</p>
<figure><p class="scroll-hint">Diagram: swipe sideways. The list below says the same thing.</p>
<div class="scroll" tabindex="0" aria-label="Critical path, scrolls sideways">{svg_critical(tmap, merged)}</div>
<figcaption>Filled and ticked = merged. Dashed = not yet.</figcaption>
<ol class="words">{"".join(f"<li><code>{c}</code> {E(short(tmap[c]['title'], 90))} — {'merged' if c in merged else 'not merged yet'}</li>" for c in CRITICAL)}</ol></figure>
</section>

<section aria-labelledby="next-h">
<h2 id="next-h">7 · What can start now, and the risk</h2>
<p class="section-sub">A ticket can start when every ticket it depends on is merged. Phase B picks critical-path tickets first,
then the rest of the wave, and cuttable tickets last.</p>
<div class="grid two">
<article class="card" data-status="fact"><h3>Can start now: {len(ready)} <span class="st fact">Fact</span></h3><ul class="tks">{"".join(chip(t, "ready") for t in ready[:24])}</ul>
{f'<p class="src">…and {len(ready) - 24} more in the table.</p>' if len(ready) > 24 else ""}</article>
<article class="card" data-status="unknown"><h3>The deadline <span class="st unknown">Unknown</span></h3>
<p>It is due Tuesday 2026-10-27 at 03:00 CT. Whether everything fits is not known yet. The plan's own note says the tail after the full
run is seven waves of mostly human and document work.</p>
<p>The levers are written down. If the three-lesson trial (<code>NL-109</code>) fails, cuts #1–#5 go. If two-person approval
(<code>NL-115</code>) is late, cuts #1–#7 go. The full run and honest numbers are never traded for a feature.</p>
<p class="src">Slice plan, <em>Execution order</em> rule 7 and open item 8.</p></article>
</div>
</section>

<section aria-labelledby="all-h">
<h2 id="all-h">8 · Every ticket</h2>
<p class="section-sub">All {total} tickets. Each ID links to its GitLab issue. Use the filters, or read the whole table: it works without them.</p>
<div class="filters" role="search">
<label>Status <select id="f-st"><option value="">All</option><option value="done">Merged</option><option value="ready">Can start</option><option value="waiting">Waiting on others</option><option value="you">Your action</option></select></label>
<label>Journey step <select id="f-step"><option value="">All</option>{"".join(f'<option value="{k}">{E(n)}</option>' for k, n, *_ in STEPS + SIDE)}</select></label>
<label>Wave <select id="f-wave"><option value="">All</option>{"".join(f'<option value="{k}">Wave {k}</option>' for k in waves)}</select></label>
<label>Search <input id="f-q" type="search" placeholder="ID or words"></label>
<span id="count" aria-live="polite">{total} shown</span></div>
<div class="table-scroll" tabindex="0" aria-label="Ticket table, scrolls sideways"><table>
<thead><tr><th scope="col">ID</th><th scope="col">What it builds</th><th scope="col">Journey step</th><th scope="col">Kind</th><th scope="col">Lane</th><th scope="col">Wave</th><th scope="col">Status</th><th scope="col">Waits on</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>
</section>
</main>
<footer class="wrap">Local file, not published. The repo's plan files and GitLab are the source of truth. This page is a count of them
at commit {E(head_sha)}. Rebuild it with the refresh command in the header.</footer>
<script>
(function(){{var s=document.getElementById('f-st'),p=document.getElementById('f-step'),w=document.getElementById('f-wave'),q=document.getElementById('f-q'),c=document.getElementById('count');
var rows=[].slice.call(document.querySelectorAll('tbody tr'));
function f(){{var n=0,t=q.value.trim().toLowerCase();rows.forEach(function(r){{var ok=(!s.value||r.dataset.st===s.value)&&(!p.value||r.dataset.step===p.value)&&(!w.value||r.dataset.wave===w.value)&&(!t||r.textContent.toLowerCase().indexOf(t)>-1);r.hidden=!ok;if(ok)n++;}});c.textContent=n+' shown';}}
[s,p,w].forEach(function(e){{e.addEventListener('change',f);}});q.addEventListener('input',f);}})();
</script>
</body>
</html>
"""
    out = root / "docs/artifacts" / f"{a.date}-ticket-map.html"
    out.write_text(page)
    print(f"wrote {out} ({len(page) // 1024} KB): {done}/{total} merged, steps {dict((k, (v['done'], v['total'])) for k, v in counts.items())}")
    unplaced = [t["id"] for t in tickets if t["_step"] not in counts]
    if unplaced:
        print("UNPLACED:", unplaced)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
