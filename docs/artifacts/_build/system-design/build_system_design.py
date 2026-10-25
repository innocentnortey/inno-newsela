#!/usr/bin/env python3
"""Build docs/artifacts/2026-10-25-system-design.html (Stage 6 visual review page).

Run from anywhere:  python3 -I docs/artifacts/_build/system-design/build_system_design.py
Then:  python3 -I .claude/skills/zero-to-hero/scripts/stamp_review_page.py docs/artifacts/2026-10-25-system-design.html
       python3 -I .claude/skills/zero-to-hero/scripts/check_review_page.py docs/artifacts/2026-10-25-system-design.html

The Markdown sources own every fact. This script (a) copies tables, lists and paragraphs from them
mechanically (so numbers are never retyped), and (b) adds the story, diagrams, cards and asks around them.
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "docs/artifacts/2026-10-25-system-design.html"
TEMPLATE = ROOT / ".claude/skills/zero-to-hero/templates/visual-review-page.html"

DESIGN = ROOT / "docs/design"
SPIKES = ROOT / "docs/analysis/spikes"


def read(p):
    return Path(p).read_text(encoding="utf-8")


DO1 = read(DESIGN / "system-design.md")
DO2 = read(DESIGN / "architecture.md")
DO3 = read(DESIGN / "code-design.md")
DO5 = read(DESIGN / "eval-plan.md")
SP1 = read(SPIKES / "SP-1-one-call-draft.md")
SP2 = read(SPIKES / "SP-2-freeze-at-submit.md")
SP3 = read(SPIKES / "SP-3-invention-scans.md")
DRY = read(DESIGN / "spec-dry-run.md")
READY = read(DESIGN / "system-design-readiness.md")

# ---------------------------------------------------------------- markdown helpers


def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)  # links -> plain text
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\*\w])\*([^*\n]+)\*(?![\*\w])", r"<em>\1</em>", s)
    s = re.sub(r"(?<![\w])_([^_\n]+)_(?![\w])", r"<em>\1</em>", s)
    return s


def sec(doc, prefix, level=2):
    """Body of the section whose heading starts with prefix (excluding the heading line)."""
    lines = doc.split("\n")
    hashes = "#" * level
    start = None
    for i, ln in enumerate(lines):
        if ln.startswith(hashes + " ") and ln[level + 1:].startswith(prefix):
            start = i + 1
            break
    if start is None:
        raise SystemExit(f"section not found: {prefix!r}")
    end = len(lines)
    for j in range(start, len(lines)):
        m = re.match(r"^(#{1,%d}) " % level, lines[j])
        if m:
            end = j
            break
        if lines[j].strip() == "---":
            end = j
            break
    return "\n".join(lines[start:end])


def blocks(text):
    out, lines, i = [], text.split("\n"), 0
    while i < len(lines):
        ln = lines[i]
        if not ln.strip() or ln.strip().startswith("<!--"):
            i += 1
            continue
        if ln.startswith("```"):
            j = i + 1
            while j < len(lines) and not lines[j].startswith("```"):
                j += 1
            out.append(("pre", "\n".join(lines[i + 1:j])))
            i = j + 1
            continue
        m = re.match(r"^(#{3,5}) (.*)", ln)
        if m:
            out.append(("h", m.group(2)))
            i += 1
            continue
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in re.split(r"(?<!\\)\|", lines[i].strip().strip("|"))]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            out.append(("table", rows))
            continue
        if re.match(r"^(- |\d+\. )", ln):
            ordered = bool(re.match(r"^\d+\. ", ln))
            items = []
            while i < len(lines) and (re.match(r"^(- |\d+\. )", lines[i]) or (lines[i].startswith("  ") and lines[i].strip())):
                if re.match(r"^(- |\d+\. )", lines[i]):
                    items.append(re.sub(r"^(- |\d+\. )", "", lines[i]))
                else:
                    items[-1] += " " + lines[i].strip()
                i += 1
            out.append(("ol" if ordered else "ul", items))
            continue
        if ln.startswith(">"):
            para = []
            while i < len(lines) and lines[i].startswith(">"):
                para.append(lines[i].lstrip("> ").strip())
                i += 1
            out.append(("p", " ".join(para)))
            continue
        para = []
        while i < len(lines) and lines[i].strip() and not re.match(r"^(\||#{3,5} |- |\d+\. |```)", lines[i]):
            para.append(lines[i].strip())
            i += 1
        out.append(("p", " ".join(para)))
    return out


def table_html(rows, cols=None, wide=True):
    if cols is not None:
        rows = [[r[c] if c < len(r) else "" for c in cols] for r in rows]
    head, body = rows[0], rows[1:]
    h = "<div class=\"table-scroll\" tabindex=\"0\" aria-label=\"Table, scrolls sideways\"><table><thead><tr>"
    h += "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>"
    for r in body:
        h += "<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>"
    return h + "</tbody></table></div>"


def render(text, drop=()):
    """Render a markdown section body to HTML. `drop`: sub-heading prefixes to skip with their content."""
    out, skipping = [], False
    for kind, val in blocks(text):
        if kind == "h":
            skipping = any(val.startswith(d) for d in drop)
            if not skipping:
                out.append(f"<h4>{inline(val)}</h4>")
            continue
        if skipping:
            continue
        if kind == "p":
            out.append(f"<p>{inline(val)}</p>")
        elif kind == "ul":
            out.append("<ul class=\"tight\">" + "".join(f"<li>{inline(x)}</li>" for x in val) + "</ul>")
        elif kind == "ol":
            out.append("<ol class=\"tight\">" + "".join(f"<li>{inline(x)}</li>" for x in val) + "</ol>")
        elif kind == "table":
            out.append(table_html(val))
        elif kind == "pre":
            out.append(f"<pre><code>{html.escape(val)}</code></pre>")
    return "\n".join(out)


def first_table(text, idx=0, cols=None):
    tabs = [v for k, v in blocks(text) if k == "table"]
    return table_html(tabs[idx], cols)


def section_open(sid, title, sub=None):
    s = f'<section aria-labelledby="{sid}-h" id="{sid}">\n<h2 id="{sid}-h">{title}</h2>\n'
    if sub:
        s += f'<p class="section-sub">{sub}</p>\n'
    return s


PD32 = '<span class="pd32" title="Recorded on Innocent\'s standing authorization PD-32, 2026-10-25. He has not read it.">PD-32</span>'


def statusline(kind, text):
    label = {"fact": "Fact", "decision": "Decision", "proposal": "Proposal", "unknown": "Unknown", "awaiting": "Awaiting approval"}[kind]
    return f'<p class="statusline" data-status="{kind}"><span class="st {kind}">{label}</span> {text}</p>\n'


def svg_wrap(svg, caption, words):
    return (
        "<figure>\n<p class=\"scroll-hint\">Diagram: swipe sideways. The numbered text below it says the same thing.</p>\n"
        "<div class=\"scroll\" tabindex=\"0\" aria-label=\"Diagram, scrolls sideways\">\n" + svg + "\n</div>\n"
        f"<figcaption>{caption}</figcaption>\n<ol class=\"words\">" + "".join(f"<li>{w}</li>" for w in words) + "</ol>\n</figure>\n"
    )


MARKER = '<defs><marker id="%s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head" d="M0,0 L10,5 L0,10 z"/></marker></defs>'


def box(x, y, w, h, cls, title, lines=(), tx=None):
    tx = x + 10 if tx is None else tx
    s = f'<rect class="node {cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="8"/>'
    s += f'<text x="{tx}" y="{y + 22}" class="strong">{html.escape(title)}</text>'
    for i, ln in enumerate(lines):
        s += f'<text x="{tx}" y="{y + 40 + i * 15}" class="small">{html.escape(ln)}</text>'
    return s


def tb(x, y, label):
    return f'<circle cx="{x}" cy="{y}" r="15" class="tbdot"/><text x="{x}" y="{y + 4}" text-anchor="middle" class="tbtext">{label}</text>'


# ---------------------------------------------------------------- diagrams


def svg_journey():
    s = '<svg viewBox="0 0 1040 250" role="img" aria-labelledby="jt jd"><title id="jt">The journey of one unit, from outline to export</title>'
    s += '<desc id="jd">Seven steps in two lanes. People do the top lane: upload, confirm, review and edit, approve. The system does the bottom lane: validate, generate, check, freeze, export.</desc>'
    s += MARKER % "ahj"
    s += '<rect class="lane-family" x="0" y="8" width="1040" height="110" rx="8"/><rect class="lane-assistant" x="0" y="128" width="1040" height="112" rx="8"/>'
    s += '<text class="lane-label" x="12" y="28">PEOPLE</text><text class="lane-label" x="12" y="148">THE SYSTEM</text>'
    s += box(100, 38, 150, 66, "decision", "Author uploads", ["the unit outline", "(a Google Sheet)"])
    s += box(285, 38, 150, 66, "decision", "Author confirms", ["errors and defaults", "then presses Generate"])
    s += box(620, 38, 150, 66, "decision", "Reviewers edit", ["Lesson 4 together", "(live, on a socket)"])
    s += box(805, 38, 150, 66, "decision", "Approver approves", ["one pinned snapshot,", "one lesson at a time"])
    s += box(100, 156, 150, 66, "decision", "Validate in code", ["no model call", "(PD-27)"])
    s += box(285, 156, 150, 66, "decision", "Generate 47 lessons", ["one model call each,", "checked in code"])
    s += box(455, 156, 150, 66, "decision", "Check after store", ["blocking issues", "within 5 s [T]"])
    s += box(620, 156, 150, 66, "decision", "Freeze at Submit", ["snapshot, hash,", "state vector"])
    s += box(805, 156, 150, 66, "decision", "Export", ["approved snapshots", "only"])
    for a, b in [((250, 71), (285, 71)), ((175, 104), (175, 156)), ((360, 104), (360, 156)), ((435, 189), (455, 189)), ((605, 189), (620, 189)), ((695, 104), (695, 156)), ((770, 189), (805, 189)), ((880, 104), (880, 156))]:
        s += f'<path class="arrow" d="M{a[0]},{a[1]} L{b[0]},{b[1]}" marker-end="url(#ahj)"/>'
    s += '<path class="arrow" d="M175,104 L175,120" /><path class="arrow dash" d="M530,156 L530,100 L620,80" marker-end="url(#ahj)"/>'
    s += "</svg>"
    return s


def svg_map():
    s = '<svg viewBox="0 0 1040 560" role="img" aria-labelledby="mt md"><title id="mt">System map with trust boundaries</title>'
    s += '<desc id="md">The browser talks to the web app over HTTP and to the collaboration server over a websocket. The web app, collaboration server, worker and Postgres run inside one Docker Compose network. The worker and web app call Anthropic. The worker may call a judge model through OpenRouter. The web app reads one public Google Sheets export link per upload. The restricted source folder never enters the system.</desc>'
    s += MARKER % "ahm"
    s += '<rect class="band" x="205" y="14" width="470" height="440" rx="12"/>'
    s += '<text class="band-label" x="218" y="34">Our machine: one Docker Compose network (TB-6)</text>'
    s += box(20, 190, 150, 100, "fact", "Browser", ["author, reviewer,", "approver"])
    s += box(235, 56, 200, 82, "decision", "web (Next.js)", ["pages + HTTP API", "intake, approve, export"])
    s += box(235, 196, 200, 82, "decision", "collab (Hocuspocus)", ["only writer of lesson", "content (HP-4)"])
    s += box(235, 340, 200, 82, "decision", "worker (Node)", ["generation + checks", "spend reservation"])
    s += box(520, 110, 140, 230, "decision", "Postgres", ["records", "job + check queues", "Yjs documents", "traces", "audit log", "not published"])
    s += box(790, 28, 230, 70, "decision", "Google Sheets", ["one public export GET", "per upload"])
    s += box(790, 372, 230, 74, "decision", "Anthropic API", ["UnitPlan, draft, repair,", "AI assist"])
    s += box(790, 470, 230, 74, "proposal", "Judge via OpenRouter", ["cut #2: may not be built", "advisory only"])
    s += box(20, 400, 170, 80, "decision", "docs/source/restricted/", ["git-ignored; never", "mounted (TB-7)"])
    # arrows
    P = lambda d, dash=False, mk="ahm": f'<path class="arrow{" dash" if dash else ""}" d="{d}" marker-end="url(#{mk})"/>'
    s += P("M170,215 L235,100") + P("M170,250 L235,236") + P("M335,138 L335,196")
    s += P("M435,92 L520,150") + P("M435,237 L520,237") + P("M435,372 L520,320")
    s += P("M435,76 L790,62") + P("M435,400 L790,408") + P("M435,420 L790,500", True)
    s += tb(200, 150, "TB-1") + tb(200, 262, "TB-2") + tb(612, 78, "TB-5") + tb(612, 405, "TB-3") + tb(612, 462, "TB-4") + tb(478, 130, "TB-6")
    s += '<text class="small" x="345" y="172">internal HTTP + bearer token</text>'
    s += '<text class="small" x="20" y="520">TB-n = trust boundary n in the table below. Dashed arrow and box = may not be built.</text>'
    s += '<text class="small" x="450" y="478">The web app also calls Anthropic for AI assist (cut #8).</text>'
    s += "</svg>"
    return s


def svg_trace():
    # scale: 160 px per second; limit 5 s = 800 px; origin x=60
    X0, K = 60, 160
    steps = [("debounce", 2.0, "decision"), ("store", 0.5, "proposal"), ("claim", 0.5, "proposal"), ("checks", 0.05, "proposal"), ("write", 0.05, "proposal"), ("refetch", 0.3, "proposal")]
    s = '<svg viewBox="0 0 1040 330" role="img" aria-labelledby="tt td"><title id="tt">Time budget for one edit to become a refreshed issue list</title>'
    s += '<desc id="td">A bar made of six steps adds up to about 3.4 seconds against a limit of 5 seconds. The debounce is 2 seconds, the store 0.5, the claim 0.5, the checks 0.05, the write 0.05 and the refetch 0.3.</desc>'
    s += '<text class="small" x="60" y="26">0 s</text><text class="small" x="%d" y="26">1 s</text><text class="small" x="%d" y="26">2 s</text><text class="small" x="%d" y="26">3 s</text><text class="small" x="%d" y="26">4 s</text><text class="small" x="%d" y="26">5 s limit [T]</text>' % (X0 + K - 6, X0 + 2 * K - 6, X0 + 3 * K - 6, X0 + 4 * K - 6, X0 + 5 * K - 40)
    for i in range(6):
        s += f'<path d="M{X0 + i * K},34 L{X0 + i * K},120" stroke="var(--line)" stroke-width="1"/>'
    x = X0
    for name, sec_, cls in steps:
        w = max(sec_ * K, 3)
        s += f'<rect class="node {cls}" x="{x}" y="50" width="{w:.1f}" height="44" rx="3"/>'
        x += sec_ * K
    s += f'<path d="M{X0 + 5 * K},34 L{X0 + 5 * K},120" stroke="var(--awaiting)" stroke-width="3" stroke-dasharray="6 4"/>'
    s += f'<text class="strong" x="{X0}" y="148">Total ≈ 3.4 s [C on A]; headroom ≈ 1.6 s</text>'
    labels = [("1 Debounce ≤ 2 s [T]", 60, 190), ("2 Store transaction p95 ≤ 500 ms [T]", 60, 214), ("3 Worker claims the check (NOTIFY, 500 ms poll) ≤ 0.5 s [A]", 60, 238), ("4 Checks run ≈ 50 ms [A]", 60, 262), ("5 Issues written < 50 ms [A]", 60, 286), ("6 Workspace refetches p95 < 300 ms [T]", 60, 310)]
    for t, lx, ly in labels:
        s += f'<text x="{lx}" y="{ly}">{html.escape(t)}</text>'
    s += '<text class="small" x="560" y="190">Bar colours: solid = from the 2 s debounce target (R-26);</text><text class="small" x="560" y="206">dashed = each step is an assumption [A] or a target [T].</text>'
    s += '<text class="small" x="560" y="238">SP-2 measured the store alone: p95 25.1 ms on PGlite [M],</text><text class="small" x="560" y="254">so the 500 ms line has room (indicative, not real Postgres).</text>'
    return s + "</svg>"


def svg_job():
    s = '<svg viewBox="0 0 1040 330" role="img" aria-labelledby="jt2 jd2"><title id="jt2">One lesson generated, with its repair and failure branches</title>'
    s += '<desc id="jd2">The worker claims a job, reserves spend, makes one draft call, parses, compiles and checks. If the blocking checks pass it stores version 1 and settles the cost. If they fail it makes one repair call and checks again. If that still fails, or a brake fires, the job is marked generation failed with reasons.</desc>'
    s += MARKER % "ahj2"
    P = lambda d, dash=False: f'<path class="arrow{" dash" if dash else ""}" d="{d}" marker-end="url(#ahj2)"/>'
    s += box(10, 40, 130, 70, "decision", "1 Claim job", ["SKIP LOCKED + lease", "< 50 ms [A]"])
    s += box(160, 40, 130, 70, "decision", "2 Reserve spend", ["worst case, three", "caps, < 20 ms [A]"])
    s += box(310, 40, 140, 70, "decision", "3 Draft call", ["one LessonDraft", "~83 s [M] row 8"])
    s += box(470, 40, 140, 70, "decision", "4 Parse + checks", ["Zod, compile,", "blocking checks"])
    s += box(640, 40, 130, 70, "decision", "6 Store v1", ["idempotent insert,", "≤ 500 ms [T]"])
    s += box(790, 40, 130, 70, "decision", "7 Settle cost", ["from usage fields,", "job = terminal"])
    s += box(470, 170, 140, 70, "decision", "5 Repair (once)", ["failing checks only,", "then re-check"])
    s += box(640, 250, 280, 64, "proposal", "generation_failed + reasons", ["truncated, timeout, rate_limited, cap, check ids", "the tile says why; Retry failed button"])
    s += P("M140,75 L160,75") + P("M290,75 L310,75") + P("M450,75 L470,75") + P("M610,75 L640,75") + P("M770,75 L790,75")
    s += P("M540,110 L540,170", True) + P("M610,205 L705,110", True) + P("M610,225 L640,270", True)
    s += '<text class="small" x="548" y="146">checks fail</text><text class="small" x="590" y="168">passes</text>'
    s += '<text class="small" x="10" y="150">Every step is retry-safe: a restart between 3 and 6 finds the raw output</text><text class="small" x="10" y="166">saved in model_call and skips the call.</text>'
    s += '<text class="small" x="10" y="200">Brakes (DO-2 §5.2): 1 repair round; ≤ 3 retries on 429/5xx;</text><text class="small" x="10" y="216">1 raised-cap retry on truncation; 10 min wall clock; spend caps;</text><text class="small" x="10" y="232">≤ 6 in flight; circuit breaker pauses a run after 3 same-check failures.</text>'
    return s + "</svg>"


def svg_scale():
    s = '<svg viewBox="0 0 1040 360" role="img" aria-labelledby="st1 sd1"><title id="st1">The scale path in five steps</title>'
    s += '<desc id="sd1">Five steps rise from left to right. Step 1 is one web, one worker, one collaboration process and Postgres. Step 2 adds a second web instance when lesson open is slow or web CPU is high. Step 3 adds a second collaboration process when remote edits lag. Step 4 raises the worker count when the generation queue waits too long. Step 5 uses the provider batch API for whole-program runs.</desc>'
    s += MARKER % "ahs"
    items = [
        ("1 Now", "1 web, 1 worker,", "1 collab, Postgres", "Trigger: none"),
        ("2 More web", "2 web behind a proxy", "sessions already in Postgres", "Trigger: lesson open p95 > 1.5 s", "or web CPU > 70%"),
        ("3 More collab", "2nd Hocuspocus,", "Postgres or Redis fan-out,", "docs sharded by lesson", "Trigger: remote edit p95 > 500 ms", "or loop lag p95 > 100 ms"),
        ("4 More workers", "raise cap to provider", "limit, then several", "workers (SKIP LOCKED ok)", "Trigger: queue wait > 15 min", "or 3-run units pass 2 h"),
        ("5 Batch API", "provider batch API for", "whole programs", "(180 lessons per grade)", "Trigger: a whole-program run", "is needed"),
    ]
    for i, it in enumerate(items):
        x = 14 + i * 205
        y = 230 - i * 40
        h = 110 + i * 40
        cls = "decision" if i == 0 else "proposal"
        s += f'<rect class="node {cls}" x="{x}" y="{y}" width="190" height="{h}" rx="8"/>'
        s += f'<text class="strong" x="{x + 10}" y="{y + 22}">{it[0]}</text>'
        for j, t in enumerate(it[1:]):
            s += f'<text class="{"small" if t.startswith("Trigger") or t.startswith("or") or t.startswith("is needed") else ""}" x="{x + 10}" y="{y + 42 + j * 15}">{html.escape(t)}</text>'
        if i:
            s += f'<path class="arrow" d="M{x - 15},{y + 40 + 40} L{x},{y + 40}" marker-end="url(#ahs)"/>'
    s += '<text class="small" x="14" y="346">Solid = built now. Dashed = a written path, each triggered by a measurement; none is built.</text>'
    return s + "</svg>"


# ---------------------------------------------------------------- page assembly

tpl = read(TEMPLATE)
CSS = re.search(r"<style>(.*?)</style>", tpl, re.S).group(1)
CSS += """
/* ---- additions for the Stage 6 study guide ---- */
.pd32{display:inline-block;font-size:11.5px;font-weight:700;padding:0 7px;border-radius:6px;border:1px solid var(--decision);color:var(--decision);background:var(--decision-bg);margin-left:4px;white-space:nowrap}
.statusline{font-size:14px;margin:var(--space-2) 0 var(--space-3)}
svg .tbdot{fill:var(--surface);stroke:var(--awaiting);stroke-width:2}
svg .tbtext{font-size:10.5px;font-weight:700;fill:var(--awaiting)}
.table-scroll table{min-width:640px}
.table-scroll:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
h4{font-size:15px;margin:var(--space-4) 0 var(--space-2);color:var(--muted)}
.kv{display:grid;grid-template-columns:max-content 1fr;gap:6px var(--space-3);font-size:14px;margin:var(--space-2) 0 0}
.kv dt{font-weight:700;color:var(--muted)} .kv dd{margin:0}
.dgrid{display:grid;gap:var(--space-3);grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr))}
.dcard h3{font-size:16px}
.waves{display:grid;gap:var(--space-2);grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))}
.wave{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:var(--space-2) var(--space-3)}
.wave h3{font-size:14px;margin:0 0 4px} .wave ul{margin:0;padding-left:18px;font-size:13px}
.decision-line{background:var(--surface-2);border-radius:8px;padding:var(--space-2) var(--space-3);margin-top:var(--space-3)}
.opts{display:grid;gap:var(--space-2);grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));margin:var(--space-3) 0}
.opt{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:var(--space-2) var(--space-3);font-size:14px}
.opt.rec{border:2px solid var(--accent)}
.opt h4{margin:0 0 4px;color:var(--ink)}
.toc{columns:2;column-gap:var(--space-4);font-size:14px;padding-left:20px}
@media (max-width:640px){.toc{columns:1}.kv{grid-template-columns:1fr}.dgrid{grid-template-columns:1fr}}
pre{overflow-x:auto;background:var(--surface-2);padding:var(--space-2);border-radius:8px;font-size:12.5px}
"""

SOURCES = [
    ("docs/design/system-design.md", "../design/system-design.md", "DO-1 system design"),
    ("docs/design/architecture.md", "../design/architecture.md", "DO-2 architecture"),
    ("docs/design/code-design.md", "../design/code-design.md", "DO-3 code design (areas summarised here)"),
    ("docs/design/component-contracts.md", "../design/component-contracts.md", "DO-4 component contracts (link only)"),
    ("docs/design/eval-plan.md", "../design/eval-plan.md", "DO-5 evaluation plan"),
    ("docs/design/observability.md", "../design/observability.md", "DO-6 observability contract"),
    ("docs/design/metrics-registry.md", "../design/metrics-registry.md", "DO-7 key-metrics registry"),
    ("docs/design/system-design-readiness.md", "../design/system-design-readiness.md", "readiness report"),
    ("docs/design/capacity-and-workload.md", "../design/capacity-and-workload.md", "capacity and workload"),
    ("docs/analysis/spikes/SP-1-one-call-draft.md", "../analysis/spikes/SP-1-one-call-draft.md", "SP-1 record"),
    ("docs/analysis/spikes/SP-2-freeze-at-submit.md", "../analysis/spikes/SP-2-freeze-at-submit.md", "SP-2 record"),
    ("docs/analysis/spikes/SP-3-invention-scans.md", "../analysis/spikes/SP-3-invention-scans.md", "SP-3 record"),
    ("docs/design/reviews/2026-10-25-code-design-review.md", "../design/reviews/2026-10-25-code-design-review.md", "code-design review"),
    ("docs/design/spec-dry-run.md", "../design/spec-dry-run.md", "spec dry run"),
]

H = []
H.append("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n")
H.append("<title>Newsela Lesson Studio — Stage 6 system design review</title>\n")
H.append("<!-- Built by docs/artifacts/_build/system-design/build_system_design.py from the Markdown sources listed in the header. Tables, lists and findings are copied mechanically; story, diagrams, cards and asks are written around them. Rebuild, stamp and re-check before any sign-off. -->\n")
H.append('<meta name="review-stage" content="Zero-to-hero Stage 6 · Design (DO-1 system design, DO-2 architecture, and what they rest on)">\n')
H.append('<meta name="review-status" content="DRAFT — not approved. Design choices recorded under Innocent\'s standing authorization PD-32; he has not read DO-1, DO-2 or the SP-1 to SP-3 results">\n')
H.append('<meta name="review-date" content="2026-10-25">\n')
for p, _, _ in SOURCES:
    H.append(f'<meta name="review-source" content="{p}|0">\n')
H.append("<style>" + CSS + "</style>\n</head>\n<body>\n")
H.append('<a class="skip" href="#main">Skip to content</a>\n')

# header
H.append('<header class="top"><div class="wrap">\n')
H.append('<p class="kicker">Zero-to-hero Stage 6 · Design · local visual review · Markdown is the source of truth</p>\n')
H.append("<h1>Newsela Lesson Studio — how the system is built, and why it should hold</h1>\n")
H.append('<div class="status-banner" role="status"><span class="st awaiting">Awaiting your review</span><div><strong>DRAFT — not approved.</strong> '
         'Nothing here is approved because it exists. The design choices were recorded on your standing authorization (PD-32, 2026-10-25: "I\'ll follow your recommendations"); '
         'you have <strong>not</strong> read DO-1, DO-2 or the three spike results (SP-1, SP-2, SP-3) yet. This page is how you read them. '
         'Anything you raise reopens the row it touches.</div></div>\n')
H.append('<dl class="meta"><dt>Review date</dt><dd>2026-10-25 (built after the Markdown sources were written)</dd>\n<dt>Sources (full documents)</dt><dd><ul class="tight">')
for p, href, what in SOURCES:
    H.append(f'<li><a href="{href}"><code>{p}</code></a> — {what} · SHA-256 <code data-sha-for="{p}">0</code></li>')
H.append('</ul></dd>\n<dt>Also linked, not summarised</dt><dd><a href="../design/hard-problems.md"><code>docs/design/hard-problems.md</code></a> (HP-1…HP-10, the Stage 3 register) · <a href="../contracts/INTERFACE.md"><code>docs/contracts/INTERFACE.md</code></a> (CON-1…CON-24, every outside promise) · <a href="../../PROJECT-CHECKLIST.md"><code>PROJECT-CHECKLIST.md</code></a> (§6 gate)</dd>\n')
H.append('<dt>Refresh</dt><dd>If any source changes, rebuild with <code>docs/artifacts/_build/system-design/build_system_design.py</code>, re-stamp and re-check before you are asked to sign off.</dd></dl>\n')
H.append('<ul class="legend" data-legend aria-label="Status legend">'
         '<li><span class="st fact" data-legend-item="fact">Fact</span> established; a source is cited, or a spike measured it</li>'
         '<li><span class="st decision" data-legend-item="decision">Decision</span> recorded with a date and rule; a <span class="pd32">PD-32</span> chip means it rests on your standing authorization and you have not read it</li>'
         '<li><span class="st proposal" data-legend-item="proposal">Proposal</span> Claude proposes; not settled</li>'
         '<li><span class="st unknown" data-legend-item="unknown">Unknown</span> not established; what would settle it is named</li>'
         '<li><span class="st awaiting" data-legend-item="awaiting">Awaiting approval</span> asked of you at this gate</li></ul>\n')
H.append("</div></header>\n<main id=\"main\" class=\"wrap\">\n")

# contents
H.append(section_open("toc", "Where things are on this page", "A study guide: read the first three parts for the picture, then go as deep as you like."))
H.append('<ol class="toc">'
         '<li><a href="#glance">At a glance</a></li><li><a href="#story">The story so far</a></li><li><a href="#howto">How to read the labels</a></li>'
         '<li><a href="#map">System map and trust boundaries</a></li><li><a href="#trace">One request traced, with its time budget</a></li>'
         '<li><a href="#job">One lesson generated</a></li><li><a href="#load">Load and bottlenecks</a></li><li><a href="#scale">The scale path</a></li>'
         '<li><a href="#decisions">Every major decision</a></li><li><a href="#do1">DO-1 findings in full</a></li><li><a href="#do2">DO-2 findings in full</a></li>'
         '<li><a href="#spikes">The three spikes</a></li><li><a href="#rest">The rest of the design</a></li><li><a href="#reviews">Reviews and the dry run</a></li>'
         '<li><a href="#unknowns">What is not known</a></li><li><a href="#asks">Open items for you</a></li><li><a href="#approval">The approval request</a></li></ol>\n</section>\n')

# at a glance
H.append('<section aria-labelledby="glance-h" id="glance" data-visual="summary">\n<h2 id="glance-h">At a glance</h2>\n<div class="grid three">\n')
H.append('<article class="card" data-status="fact"><h3>Shape <span class="st fact">Fact</span></h3><p class="big">Three Node programs and one database.</p><p class="src">web, worker and collab run beside one Postgres that holds every record, both queues, the live documents and the traces. Source: DO-2 §1; DO-1 opening.</p></article>\n')
H.append('<article class="card" data-status="fact"><h3>SP-1 <span class="st fact">Fact</span></h3><p class="big">One model call per lesson works.</p><p class="src">3 of 3 lessons valid after at most one repair, 0 truncations, slowest 119.7 s, dearest $0.26 [M]. One mechanism changed: the schema goes in the prompt. SP-1 record.</p></article>\n')
H.append('<article class="card" data-status="fact"><h3>SP-2 <span class="st fact">Fact</span></h3><p class="big">Freezing at Submit holds while two people type.</p><p class="src">20 of 20 trials, 0 edits after the lock, 0 silent losses; store p95 25.1 ms on PGlite [M]. SP-2 record.</p></article>\n')
H.append('<article class="card" data-status="fact"><h3>SP-3 <span class="st fact">Fact</span></h3><p class="big">Quote and page scans catch every plant. The name scan can block only in check items.</p><p class="src">11 of 11 code-detectable plants caught; name-scan false flags are 0 in check items, many elsewhere [M]. SP-3 record.</p></article>\n')
H.append('<article class="card" data-status="decision"><h3>Size <span class="st decision">Decision</span></h3><p class="big">Built for 500 users a day and a 200-user spike.</p><p class="src">Your words, 2026-10-25 (PD-33): "no 200-day requirement". Replaces the earlier 25-user figure. Capacity doc.</p></article>\n')
H.append('<article class="card" data-status="unknown"><h3>Load <span class="st unknown">Unknown</span></h3><p class="big">No load test has run yet.</p><p class="src">Every interactive figure is an assumption [A] until the 200-user script runs on the VPS (WF-29). Who closes it: the build, Stage 8.</p></article>\n')
H.append('<article class="card" data-status="proposal"><h3>Checks place <span class="st proposal">Proposal</span></h3><p class="big">Checks run in the worker, not in the editor\'s process (D-6).</p><p class="src">Taken on PD-32; open to your other choice. See ask Q-1.</p></article>\n')
H.append('<article class="card" data-status="awaiting"><h3>Asked of you now <span class="st awaiting">Awaiting approval</span></h3><p class="big">Read DO-1, DO-2 and the three spike results, answer five open items, then approve the §6 gate or send it back.</p><p class="src">Last part of this page.</p></article>\n')
H.append("</div>\n</section>\n")

# story
H.append('<section aria-labelledby="story-h" id="story" data-visual="story">\n<h2 id="story-h">The story so far</h2>\n')
H.append('<p class="lede">Newsela is a company that makes reading material for schools. It is moving into California\'s core reading and English-learner classes. That means about 180 lessons for each grade, each about 50 minutes long, each written in Newsela\'s own lesson shape and good enough for state reviewers. The brief asks us to build a tool that takes a designer\'s unit outline (a Google Sheet), has a model write the lessons, and then lets staff review, edit and approve them.</p>\n')
H.append('<p>Stage 1 found that the real cost is not writing. It is the time a person spends checking each lesson. So the number we aim at (the north star, PD-1) is <strong>reviewer minutes per approved lesson</strong>. A system that writes quickly but wastes review time has missed the point.</p>\n')
H.append('<p><strong>One evening in the demo.</strong> On Sunday evening an author uploads the Grade 6 Unit 4 outline and presses Generate. The web app writes one run and 47 job rows to the database in one go and answers in well under a second. A separate worker program picks the jobs up six at a time, asks the model for one lesson per job, checks each lesson with plain code, fixes a failing one at most once, and stores it. About 25 minutes later [C on A] the board shows 47 tiles. Most say <code>ready</code>; a few say <code>failed</code> with a reason and a "retry failed" button. Meanwhile many reviewers are editing other lessons through a third program that handles live typing. Their typing never waits behind generation, because the two kinds of work run in different programs with different limits.</p>\n')
H.append(svg_wrap(svg_journey(), "The unit\'s journey. People act in the top lane; the system acts in the bottom lane. <span class=\"st decision\">Decision</span> shapes from PRD §5.1 and DO-2 §4; nothing here is a new proposal.",
                  ["The author uploads the outline; the system validates it in plain code with no model call (PD-27).",
                   "The author confirms any errors and the default for each warning, then presses Generate; the system makes 47 jobs and generates a lesson per job.",
                   "After each store the system runs the checks again; blocking problems show within 5 seconds [T].",
                   "Reviewers edit together; one of them presses Submit, which freezes the lesson into a snapshot with a hash.",
                   "The approver approves that exact snapshot, one lesson per call; the system exports approved snapshots only."]))
H.append('<h3>What earlier stages settled</h3>\n<ul class="tight">'
         '<li><strong>Stage 3</strong> found ten hard problems (HP-1…HP-10), each with a chosen option, recorded under PD-32. Orchestration (HP-1) came first. <a href="../design/hard-problems.md">Register</a>.</li>'
         '<li><strong>The interface spec</strong> has 24 cards (CON-1…CON-24), all marked <code>agreed</code> after the System review (DO-3 header).</li>'
         '<li><strong>Five foundation answers</strong> fix the load (500 users a day, a 200-user spike), the failure to survive (a worker restart mid-run), the spend ceiling ($0 new hosting, $75 for model calls), and the hardest uncertainty (can one call write a lesson?).</li></ul>\n')
H.append('<h3>What changed the design after it was first drawn</h3>\n<ul class="tight">'
         '<li><strong>PD-33, your load figure.</strong> It moved the target from 25 editors to a 200-user spike. That is why checks left the live-editing program (D-6) and why the 200-user load test exists.</li>'
         '<li><strong>SP-1.</strong> One call per lesson passes, but the API\'s strict-schema mode refused our lesson schema, so the schema now travels in the prompt and code validates the answer. It also set the caps: six jobs in flight, $13.00 per run, 240 seconds per call.</li>'
         '<li><strong>SP-2.</strong> Freezing in place beats closing every connection. The close-all rival brought refused keystrokes back (120 in 20 trials), so DO-3 now says "do not build it".</li>'
         '<li><strong>SP-3.</strong> The name scan cannot block everywhere on real drafts, so it blocks only in check items.</li>'
         '<li><strong>The code-design review (Metz).</strong> It returned FAIL with three blocking findings about build order, shared files and carrying SP-2 into the design. DO-3 and DO-4 carry the fixes now; see <a href="#reviews">Reviews</a> for what is and is not re-checked.</li>'
         '<li><strong>The spec dry run.</strong> An agent tried to write tests for three tickets from the design alone and found 29 gaps. All 29 are closed.</li></ul>\n')
H.append("</section>\n")

# howto
H.append(section_open("howto", "How to read the labels", "Every number in the design carries a letter that says where it came from. Keep this table open while you read."))
H.append(table_html([["Label", "Plain meaning", "Example from this design"],
                     ["[F]", "A fact from an issued or outside source", "The deadline is Tuesday 2026-10-27, 03:00 CT"],
                     ["[T]", "A target we chose", "Remote edits show up for co-editors in under 500 ms at the 200-user spike (p95: 95 times out of 100)"],
                     ["[A]", "An assumption a measurement will replace", "A check takes about 50 ms"],
                     ["[C]", "A calculation from labelled inputs; [C on A] means the inputs were assumptions", "About 26 minutes for one unit, from ⌈47 ÷ 6⌉ × ~3 min + ~2 min"],
                     ["[M]", "A measurement we took", "Lesson 4 took 83.1 s and cost $0.1445 (SP-1)"],
                     ["[A] → SP-n", "An assumption a named spike is running", "Concurrency cap 4 to 6 → SP-1"]]))
H.append('<p>Two more words. A <strong>p95</strong> is the time that 95 of 100 requests beat. A <strong>trust boundary</strong> is a line where data passes from something we control to something we do not (or from one trust level to another), so it must be checked there.</p>\n</section>\n')

# map
H.append(section_open("map", "System map and trust boundaries",
                      "Where each part runs, what crosses each line, and what never leaves. This answers the question \"what could go wrong if I trusted this input?\""))
H.append(statusline("proposal", f"Claude's design, recorded under PD-32 on 2026-10-25 {PD32}; you have not read it. DO-2 §1–§3."))
H.append('<p><strong>Why it matters here.</strong> The outline sheet is typed by people and can hold odd text. The model\'s answers are guesses written in fluent English. If either one is trusted without a check, a wrong standard code or an invented quote could reach a teacher. So the design treats both as untrusted data and checks them in code before anything is stored.</p>\n')
H.append(svg_wrap(svg_map(), "System map. Circles are trust boundaries TB-1…TB-6; the restricted folder is TB-7.",
                  ["The browser reaches the web app by HTTP (TB-1) and the collaboration server by one websocket per lesson (TB-2).",
                   "The web app, collab, worker and Postgres share one Docker Compose network; Postgres is not published to the host (TB-6).",
                   "The web app calls collab through an internal HTTP route with a bearer token; they otherwise meet only in Postgres rows and NOTIFY signals.",
                   "The web app reads one public Google Sheets export link per upload (TB-5). The worker and the web app call Anthropic (TB-3).",
                   "The worker may call a judge model through OpenRouter (TB-4); that part is cut #2 and may not be built.",
                   "The restricted source folder is git-ignored and never mounted into any container (TB-7)."]))
H.append(render(sec(DO2, "2. Trust boundaries")))
H.append("</section>\n")

# trace
H.append(section_open("trace", "One request traced, with its time budget",
                      "Here the story is a reviewer's edit. Reviewer Mira deletes the only checking item for standard RL.6.6 in Lesson 4. The issue list must show \"RL.6.6 has no checking item\" as blocking within 5 seconds, or she may press Submit on a lesson that has a hole in it."))
H.append(statusline("proposal", f"A budget made of targets [T] and assumptions [A]; the 200-user load script will replace them with measurements {PD32}. DO-1 §4.1."))
H.append(svg_wrap(svg_trace(), "The six serial steps add up to about 3.4 s against the 5 s target. The live broadcast to co-editors (step 2 in the table, p95 < 500 ms) runs in parallel and is not in this sum.",
                  ["Debounce: the collaboration server waits up to 2 s so a burst of typing makes one store, not twenty.",
                   "Store: one database transaction writes the document bytes, the derived lesson JSON, a SHA-256 and the state vector, plus one check job.",
                   "Claim: the worker is woken by NOTIFY, with a 500 ms poll as backup, and takes the check job.",
                   "Checks run in about 50 ms; the issue rows are written in under 50 ms.",
                   "The workspace re-reads the issue list (p95 < 300 ms). Total ≈ 3.4 s, about 1.6 s of headroom."]))
H.append(render(sec(DO1, "4.1 The traced request", 3)))
H.append("</section>\n")

# job
H.append(section_open("job", "One lesson generated",
                      "The second story is a background job: outline row 8 becomes Lesson 4, Reading. This is the path that spends money, so every step is built to be safe to repeat."))
H.append(statusline("proposal", f"The step budget is mostly [A]; SP-1 measured step 3 and the repair rate {PD32}. DO-1 §4.2."))
H.append(svg_wrap(svg_job(), "The lesson job. Dashed arrows are branches; the solid row is the happy path.",
                  ["Claim the job with a lease; reserve the call's worst-case cost against three caps in one atomic update.",
                   "Make one draft call. SP-1 measured 83.1 s for row 8, 119.7 s for row 9 and 56.6 s for row 25 [M].",
                   "Parse, compile into the editor's format and run the blocking checks in code. A failing check sends the job to one repair call and then a re-check.",
                   "Store version 1 with an idempotent insert, settle the real cost from the usage fields, mark the job done.",
                   "If it still fails, or a brake fires, the job is stored as generation_failed with its reasons."]))
H.append(render(sec(DO1, "4.2 The traced background job", 3)))
H.append(render(sec(DO2, "5.2 Loop brakes", 3)))
H.append("</section>\n")

# load
H.append(section_open("load", "Load and bottlenecks, today and at the scale target",
                      "\"Today\" here means the size the build is designed for: 500 users a day, a 200-user spike, one unit generating at a time. \"The scale target\" means the larger loads the written scale path reaches, up to whole grade programs of 180 lessons."))
H.append(statusline("proposal", f"Arithmetic from labelled inputs; every [A] waits for the load script or SP-1 {PD32}. DO-1 §3, §5, §7.3."))
H.append("<p><strong>Two kinds of load, never mixed.</strong> Two hundred people online costs web, database and socket capacity. Generation jobs cost money and are limited by the provider. Two hundred users does not mean two hundred jobs. Think of a restaurant: the number of diners and the number of dishes the kitchen is cooking at once are different limits.</p>\n")
H.append(render(sec(DO1, "3. Workload model")))
H.append("<h3>Demand against capacity at the 200-user spike</h3>\n")
H.append("<p>For each resource the question is: how much is held, for how long, by how many at once? (Little\'s Law: the average number in progress is the arrival rate times how long each one is held.)</p>\n")
H.append(render(sec(DO1, "5. Resource demand")))
H.append("<h3>What breaks first</h3>\n")
H.append(render(sec(DO1, "7.3 Bottleneck order", 3)))
H.append("<h3>What the spikes already changed (this page's own comparison)</h3>\n")
H.append("<p>DO-1 was written while SP-1 to SP-3 were still running, so it still carries the assumption in its left column. The right column is what the spike measured. Nobody has refreshed DO-1 yet; that is a known gap, listed under \"What is not known\".</p>\n")
H.append(table_html([
    ["Quantity", "DO-1 assumption", "Measured or set by a spike", "Source"],
    ["Time for one lesson", "~3 min [A]", "83.1 s, 119.7 s, 56.6 s [M] (n = 3)", "SP-1 comparison table"],
    ["Cost of one lesson", "$0.09 draft; $0.50 kept as the planning figure [A]", "$0.1445, $0.2573, $0.1444 including repairs; mean $0.182 [M]", "SP-1"],
    ["Draft output tokens", "~6,600 [A]", "~11.2k on a first call [M]", "SP-1"],
    ["Draft input tokens", "~12,000 [A]", "~5.7k [M]", "SP-1"],
    ["Repair model", "a cheaper model (PD-12)", "repair ran on the same model, Sonnet 5.5", "SP-1 assumptions reported; see ask Q-2"],
    ["Strict schema mode", "assumed to work", "HTTP 400 \"compiled grammar is too large\" on every lesson call; schema now in the prompt, Zod in code", "SP-1 result"],
    ["Jobs in flight", "starts at 4, up to 6 [A]", "6 [C], from the provider headers", "SP-1"],
    ["Rate limits", "unknown", "1,000 requests, 2,000,000 input tokens and 400,000 output tokens per minute", "SP-1 headers"],
    ["Per-run spend cap", "$6.35 to $71 depending on the cost figure used [C]", "$13.00 per run [C] (0.182 × 47 × 1.5, plus the $0.16 unit plan)", "SP-1"],
    ["Per-call timeout", "about 2 × the measured p95 [A]", "240 s [C]", "SP-1"],
    ["Raised-cap retry", "output cap 16,000 [A]", "max_tokens 32,000, retry at 48,000", "SP-1"],
    ["Store transaction p95", "≤ 500 ms [T]; actual unknown", "25.1 ms (option A, n = 130) on PGlite [M]; indicative only", "SP-2"],
    ["Name-scan scope", "blocking in checks; elsewhere per result [A]", "blocks in check items; advisory elsewhere [M]", "SP-3"],
]))
H.append("<h3>The arithmetic at today's size and at the scale target (this page's own calculation)</h3>\n")
H.append("<p>These rows are not in DO-1. They apply DO-1's method to SP-1's measured numbers. Each is labelled so you can check it.</p>\n")
H.append(table_html([
    ["Case", "Arithmetic", "Result", "Label"],
    ["One 47-lesson unit, alone", "⌈47 ÷ 6⌉ = 8 rounds × 119.7 s (the slowest lesson) + 63.8 s for the unit plan", "≈ 17 min (DO-1 said ≈ 26 min)", "[C on M]"],
    ["Cost of that unit", "47 × $0.182 + $0.158", "≈ $8.7 (DO-1 said ≈ $4.50 at list prices; the PRD planning figure is ≈ $24)", "[C on M]"],
    ["Three units at once", "47 ÷ 2 slots each × ~3 min, DO-1's own row", "≈ 71 min; 118 min at a 5-minute p95, right at the 2-hour gate", "[C on A], DO-1 §5.2"],
    ["A whole grade program, 180 lessons (scale target)", "⌈180 ÷ 6⌉ = 30 rounds × ~2 min; 180 × $0.182", "≈ 60 min and ≈ $33", "[C on M]"],
    ["That program against the caps", "$33 against the $13.00 run cap; $33 against the $75 build ceiling (44%)", "It would stop at the run cap near lesson 71. This is why scale step 5 (the batch API) and a different cap come together.", "[C on M]"],
]))
H.append("<p><strong>So what for the project.</strong> The worst measured lesson came in at 2 minutes and 26 cents, far inside the 5-minute and $1 lines. That is good news for the Sunday run. But three of three lessons is a small sample, and two of the three needed a repair. DO-1\'s target is 90% valid on the first try for the full run; SP-1 saw 1 of 3. The full 47-lesson run decides that, not this spike.</p>\n")
H.append("</section>\n")

# scale
H.append(section_open("scale", "The scale path",
                      "If the project later grows, nothing needs to be redesigned. Each step below is a written change, and each fires on a measurement, not a feeling."))
H.append(statusline("proposal", f"Claude's path from the capacity doc, recorded under PD-32 {PD32}. None of steps 2 to 5 is built. DO-1 §7.2."))
H.append(svg_wrap(svg_scale(), "Five steps. Each next step fires only when its measurement is crossed.",
                  ["Now: one web, one worker, one collab, Postgres.",
                   "Lesson open p95 above 1.5 s or web CPU above 70% at the spike: two web instances behind a proxy (stateless; sessions live in Postgres).",
                   "Remote edit p95 above 500 ms or collab event-loop lag p95 above 100 ms: a second Hocuspocus process with Postgres or Redis fan-out, documents sharded by lesson.",
                   "Generation queue wait above 15 minutes regularly, or three-run units passing the 2-hour gate: raise the worker cap to the provider\'s measured limit, then add workers; the SKIP LOCKED claim already supports several.",
                   "Whole-program runs of 180 lessons per grade: the provider\'s batch API for the full-unit path, keeping the interactive path for live demos and retries."]))
H.append(render(sec(DO1, "7.2 Scale path", 3)))
H.append(statusline("unknown", "Cost per step is <strong>not</strong> estimated in the sources. The only priced shape is the Render deploy at about $20 a month [C], not provisioned (DO-1 §7). Who could close it: the build, if a step ever fires."))
H.append("</section>\n")

# decisions
D = []


def dcard(did, title, status, because, chose, over, cost, expect, verify, revisit, note=None, chip=True):
    badge = {"decision": "Decision", "proposal": "Proposal"}[status]
    h = f'<article class="card dcard" data-status="{status}" id="{did.lower()}"><h3>{did} · {title} <span class="st {status}">{badge}</span></h3>'
    if chip:
        h += f'<p class="src">2026-10-25 · Claude\'s recommendation {PD32}; not yet read by you.</p>'
    h += '<dl class="kv">'
    for k, v in [("Because", because), ("Chose", chose), ("Over", over), ("At the cost of", cost), ("Should give", expect), ("Verify with", verify), ("Revisit when", revisit)]:
        h += f"<dt>{k}</dt><dd>{v}</dd>"
    if note:
        h += f"<dt>Since the spikes</dt><dd>{note}</dd>"
    return h + "</dl></article>\n"


D.append(dcard("D-1", "Fixed pipeline, one structured call per lesson", "decision",
               "the workflow is known in advance and every check needs typed blocks (R-19).",
               "a fixed skeleton where the model fills only the unit plan, one lesson draft per lesson and at most one repair.",
               "one call per section (HP-1 option B, kept as the fallback) and an autonomous agent (PD-3).",
               "a truncation risk on the largest lessons, and a per-section fallback we may have to build.",
               "≥ 90% schema-valid first passes [T] at ≤ $1 per lesson [T].",
               "SP-1 and the full-run report.", "SP-1 misses its pass line.",
               "SP-1 passed (PD-4 = A, proven). The API\'s strict schema mode refused the schema, so the schema goes in the prompt, Zod validates, and one repair runs. First-try valid: 1 of 3 lessons; the 90% target is for the full run and is not yet measured."))
D.append(dcard("D-2", "Postgres for everything, including the queue", "decision",
               "the board, the run summary and the queue must agree on one job\'s state, and the demo has one operator.",
               "one <code>lesson_job</code> table claimed with SKIP LOCKED and a lease (HP-7 B, PD-13, PD-19).",
               "a separate job system.",
               "about 100 lines of queue code we own and no built-in dashboard.",
               "zero duplicate lesson versions and zero re-paid calls across a restart.",
               "the kill test (observability WF-28).", "several workers or multi-unit runs need a real job system."))
D.append(dcard("D-3", "A separate worker process", "decision",
               "a 47-lesson run outlives any HTTP request and must survive a restart (R-16, T-9).",
               "a long-running worker apart from the web app.",
               "doing generation inside web requests.",
               "a third process to run and watch.",
               "interactive latency unaffected by generation.",
               "the load script running during a stubbed generation run.", "never for this build."))
D.append(dcard("D-4", "One Hocuspocus process", "decision",
               "200 concurrent users means at most about 140 open sockets [C on A], and one process holds that with about 5× headroom.",
               "one authenticated collaboration server saved to our Postgres (PD-9).",
               "several collaboration processes (that is scale step 3).",
               "a single point of failure for live editing (up to 10 s to reconnect).",
               "remote edit p95 < 500 ms at the spike [T].",
               "the load script\'s socket clients.", "scale step 3\'s trigger fires."))
D.append(dcard("D-5", "The Y.Doc is master; every store writes the derived JSON too", "decision",
               "checks, approval and export must read exactly what reviewers see.",
               "one transaction per store writing the document bytes, the derived Lesson JSON, its hash and the state vector (HP-4 A, PD-7).",
               "two copies written separately, which would drift (DO-2 §3).",
               "a slower store (p95 ≤ 500 ms [T]).",
               "zero drift between what is edited and what is approved.",
               "SP-2\'s round-trip and pinning runs.", "SP-2\'s store p95 passes the budget.",
               "SP-2 passed: round-trip hash identity 20 of 20; store p95 25.1 ms on PGlite (indicative; real Postgres is re-measured by the R-57 probe)."))
D.append(dcard("D-6", "Checks run in the worker, from a coalesced check_job", "proposal",
               "checks must refresh within 5 s of every store (R-28), and the single collaboration event loop also carries every co-editor\'s keystrokes.",
               "one <code>check_job</code> row per lesson written inside the store transaction, run by the worker.",
               "checks inside the collaboration server. If you prefer that, CON-13\'s <code>pending</code> flag comes from in-memory state and the event-loop budget loses its headroom.",
               "one more small queue table and up to ~0.5 s of claim latency [A].",
               "collab event-loop lag p95 < 50 ms [T] and store → checks ≤ 5 s [T] at the spike.",
               "the load script.", "store → checks p95 passes 3 s or worker CPU passes 70%.",
               "Not touched by a spike. Also answers CON-13\'s System question (SDQ-1).", chip=True))
D.append(dcard("D-7", "Progress by polling every 2 seconds", "decision",
               "half-formed JSON helps nobody and 40 polling users cost about 20 requests a second [C] (PD-18).",
               "polling.", "streaming.", "up to 2 s of staleness.",
               "a tile change within 3 s [T].", "a timed run on the board.", "polling passes half the web CPU."))
D.append(dcard("D-8", "Reserve-then-settle against three caps", "decision",
               "the build has a $75 hard ceiling and a check-before-call cap can overshoot by up to 6 calls under concurrency (PD-14, PD-29, HP-7).",
               "an atomic reservation of each call\'s maximum cost against the run, user-day and build caps, then settling from the real usage. (The build-total check is SDQ-3, a proposal on PD-32.)",
               "a cap checked before the call.",
               "refusing some calls that would have fit.",
               "zero overshoot.", "the cap test (cap = 3 lessons\' cost).", "SP-1\'s measured cost makes the reservation too pessimistic.",
               "SP-1 set the numbers: per-run cap $13.00, six in flight, 240 s timeout. Cost per lesson is about twice DO-1\'s list-price estimate, and well under the $0.50 planning figure."))
D.append(dcard("D-9", "Record the demo locally under Docker Compose", "decision",
               "the brief asks for source, documentation and a video, not a URL [F], and a new Render service would pass your $40-a-month cap.",
               "local recording with the deploy files committed (PD-15 option D).",
               "a Render deploy now.",
               "nothing public to click.",
               "a $0 hosting line.", "running the full demo under Compose.", "you approve the spend, or AQ-17 says a URL is expected. See ask Q-5."))
D.append(dcard("D-10", "Survive a worker restart, nothing more", "decision",
               "you named a worker restart mid-run as the failure to survive (SD-7.2) and the demo has one operator.",
               "lease expiry, a raw-output checkpoint and an idempotent store.",
               "replicas or zone failover.",
               "losing Postgres loses the project (one pg_dump after the full run mitigates it, PD-30).",
               "47 of 47 terminal lessons and 0 duplicates after a kill [T].", "the kill test.", "the system serves real staff."))
D.append(dcard("A-1", "Content has one writer", "decision",
               "two writers of lesson content would let the derived JSON drift from the live document (HP-4, R-26 as amended).",
               "the collaboration server as the only writer; HTTP-started changes go through a server-side connection.",
               "letting the web app write content too.",
               "routing four HTTP cards (CON-14, 15, 16, 17) through the socket server.",
               "zero drift between the Y.Doc and its derived row.",
               "SP-2\'s round trips, plus a test that no web-app path writes <code>lesson_doc</code>.", "a second collaboration process exists (scale step 3)."))
D.append(dcard("A-2", "Two images, three processes", "decision",
               "a worker restart must not drop editors\' sockets, and a socket crash must not stop a run (AD-15).",
               "separate worker and collab containers from one image with two entry points.",
               "one container running both.",
               "one more container to watch.",
               "independent restarts.", "killing each container during the load script.", "Render forces one service to run both (then a process manager keeps them separate)."))
D.append(dcard("A-3", "The judge on another provider, through OpenRouter", "proposal",
               "a judge on the generator\'s own model shares its blind spots (PD-12).",
               "an OpenAI model reached through OpenRouter, so the one shared key launcher serves both.",
               "OpenAI\'s API directly. If you prefer that, only the adapter and the key change.",
               "a second vendor inside the trust boundary, and its own calibration.",
               "an advisory verdict whose agreement with about 30 human labels is reported with n.", "the calibration record (R-23).", "the judge stays cut (#2), or OpenRouter\'s routing changes the served model."))
H.append(section_open("decisions", "Every major decision, with its reasoning",
                      "Each card finishes one sentence: because (the reason) → chose → over (what we did not pick) → at the cost of → should give → verify with → revisit when. The five foundation answers come first because everything else rests on them."))
H.append(statusline("decision", "The five foundation answers are yours, with dates and your words. Readiness report §2.1."))
H.append(table_html(next(v for k, v in blocks(sec(READY, "2. Decide", 2)) if k == "table"), cols=[0, 1, 2]))
H.append("<p><strong>Candour on the basis.</strong> SD-3.1 and SD-3.4 carry your own figures. SD-7.2, SD-1.6 and SD-1.9 were answered by your delegation (\"ill follow your recommendations\"), recorded as your answers with that quote. Anything you raise later reopens the affected row.</p>\n")
H.append("<h3>The decision cards</h3>\n<div class=\"dgrid\">\n" + "".join(D) + "</div>\n")
H.append("</section>\n")

# do1
H.append(section_open("do1", "DO-1 findings in full",
                      "Everything in the system design that is not already above: the frame, the promises, what happens under overload and failure, the smallest deployment, the spend caps, and how each guess will be checked. Copied from the source, so no number is retyped."))
H.append(statusline("proposal", f"Claude's design for DO-1, recorded under PD-32 {PD32}; you have not read it."))
H.append('<div class="part" data-part="context"><h3>Where this fits</h3><p>These are the rules the build keeps. When an author presses Generate at the wrong moment, when the provider says "slow down", when a process restarts, the answers below say what the person sees and what is guaranteed.</p></div>\n')
for title, pref, lvl, drop in [
    ("1 · Frame the problem", "1. Frame the problem", 2, ()),
    ("2 · Measurable promises", "2. Measurable promises", 2, ()),
    ("5.2 and 5.3 · Generation capacity and cost per lesson (before SP-1)", None, 0, ()),
    ("6 · Overload and failure behaviour", "6. Overload and failure behaviour", 2, ()),
    ("7 · The smallest deployment, and the spend caps", "7. The smallest deployment", 2, ("7.2", "7.3")),
    ("8 · Validate and revise", "8. Validate and revise", 2, ()),
    ("Values the running spikes set", "Values the running spikes set", 2, ()),
]:
    H.append(f"<h3>{title}</h3>\n")
    if pref is None:
        H.append("<p>Shown in full because these are the numbers SP-1 tested. Compare them with the table in \"Load and bottlenecks\".</p>\n")
        H.append(render(sec(DO1, "5.2 Generation capacity", 3)))
        H.append(render(sec(DO1, "5.3 Cost per lesson", 3)))
    else:
        H.append(render(sec(DO1, pref, lvl), drop=drop))
H.append("</section>\n")

# do2
H.append(section_open("do2", "DO-2 findings in full",
                      "The architecture: which parts exist, who owns each record, how data flows, every place a model decides, and how each model answer is checked."))
H.append(statusline("proposal", f"Claude's design for DO-2, recorded under PD-32 {PD32}; you have not read it."))
H.append('<div class="part" data-part="context"><h3>Where this fits</h3><p>Three people work on Unit 4 at once: an author, a reviewer and an approver. The rule that keeps their work safe is simple. A model may write a draft, but nothing the model writes reaches an approved lesson without passing code checks, and nothing becomes approved without a named person.</p></div>\n')
H.append("<h3>1 · Components</h3>\n" + render(sec(DO2, "1. Components")))
H.append("<h3>3 · Data authority: who owns each record</h3>\n" + render(sec(DO2, "3. Data authority")))
H.append("<h3>4 · Data flows</h3>\n" + render(sec(DO2, "4. Data flows")))
H.append("<h3>5 · Every place a model decides, and its rung</h3>\n" + render(sec(DO2, "5. Every place a model decides"), drop=("5.2",)))
H.append("<h3>6 · How each model answer is checked</h3>\n" + render(sec(DO2, "6. Verification rungs")))
H.append("<h3>7 · Deployment</h3>\n" + render(sec(DO2, "7. Deployment")))
H.append("</section>\n")

# spikes
H.append(section_open("spikes", "The three spikes: what was tried, what happened, what it changed",
                      "A spike is a small throwaway experiment that answers one uncertain question before we build. All three ran on 2026-10-25 and all three passed. You have not read them yet."))
H.append(statusline("fact", "Measured by the spike harnesses and re-run by the main session. Each record names its re-run command. The choice to adopt each result rests on PD-32; you have not read any of them."))
H.append('<article class="card" data-status="fact"><h3>SP-1 · Can one call write a whole lesson? <span class="st fact">Fact</span></h3>')
H.append('<p><strong>The story.</strong> The riskiest guess in the design was that one model call can write a 3,300-word lesson in Newsela\'s exact shape, in a few minutes, for under a dollar. If the call runs out of room it stops mid-sentence and the JSON is broken. SP-1 asked for Lesson 4 (the largest), Lesson 5 (a writing lesson) and a flex day, plus a 47-day unit plan.</p>')
H.append('<p><strong>What happened.</strong> All pass lines held. But the API\'s strict-schema mode refused the lesson schema as "too large" on every call, so the schema now goes inside the prompt and our own code (Zod) checks the answer. Two of the three lessons needed the one repair call. <strong>What it changed:</strong> the caps (six in flight, $13.00 a run, 240 s a call) and the shape of the model path in DO-3.</p>')
H.append(render(sec(SP1, "Results", 2)))
H.append("</article>\n")
H.append('<article class="card" data-status="fact"><h3>SP-2 · Does freezing at Submit hold while two people type? <span class="st fact">Fact</span></h3>')
H.append('<p><strong>The story.</strong> Reviewer A presses Submit while reviewer B is still typing; B\'s keystrokes are already on the wire. If any of them land after the lock, the approver approves text nobody saw. SP-2 tried two ways to freeze: flip every connection to read-only (A), or close every connection (B).</p>')
H.append('<p><strong>What happened.</strong> Both stopped late edits in 20 of 20 trials, and a control with no freeze failed as it should. B, though, brought refused keystrokes back when clients reconnected (120 in 20 trials). <strong>What it changed:</strong> A is the mechanism, and the editor must drop its refused local edits and tell the typist.</p>')
H.append(render(sec(SP2, "Results", 2)))
H.append("</article>\n")
H.append('<article class="card" data-status="fact"><h3>SP-3 · Do the scans catch invented quotes, pages and names? <span class="st fact">Fact</span></h3>')
H.append('<p><strong>The story.</strong> The model must not invent a quote, a page number or a character. Because we do not hold the novel\'s text, HP-2 chose three cheap code scans. SP-3 planted twelve inventions into lesson drafts and counted how many the scans caught, and how often they cried wolf on clean drafts.</p>')
H.append('<p><strong>What happened.</strong> The quote and page scans caught every plant with zero false flags. The name scan caught all its plants but flagged many ordinary capitalised words elsewhere. <strong>What it changed:</strong> the name scan blocks only inside check items; elsewhere it is a hint to the reviewer.</p>')
H.append(render(sec(SP3, "Results", 2)))
H.append("</article>\n</section>\n")

# rest
H.append(section_open("rest", "The rest of the design, summarised",
                      "DO-3 to DO-7 are long. This is only what you need to judge the system design; each links to its full document."))
H.append(statusline("proposal", f"All five documents are Claude's drafts, recorded under PD-32 {PD32}."))
H.append("<h3>DO-3 · Code design: twenty-odd build areas in five waves</h3>\n")
H.append("<p>The code is split into <em>areas</em>. One area is one set of files that one stream of tickets owns. Areas in the same wave share no files, and every call from one area goes to an area in an earlier wave, so parallel agents never wait on or overwrite each other. This is what the ticket-cutting stage will split along.</p>\n")
tab = [v for k, v in blocks(sec(DO3, "4. Build areas")) if k == "table"][0]
waves = {}
for r in tab[1:]:
    w, area = r[0], r[1]
    waves.setdefault(w, []).append(area)
H.append('<div class="waves">')
for w, areas in waves.items():
    H.append(f'<div class="wave"><h3>Wave {inline(w)}</h3><ul>' + "".join(f"<li>{inline(a)}</li>" for a in areas) + "</ul></div>")
H.append("</div>\n")
H.append(f'<p class="src">Source: DO-3 §4, first two columns of the build-area table. The full table also lists what each area owns and every cross-area call. The exact signatures live in <a href="../design/component-contracts.md">DO-4</a> ({len(read(DESIGN / "component-contracts.md").splitlines()):,} lines), linked to the interface cards they serve.</p>\n')
H.append("<p>DO-3 §5 also lists every seam we considered, each marked cut (it pays now) or deferred (wait for a named trigger); read it in the <a href=\"../design/code-design.md\">source</a>.</p>\n")
H.append("<h3>DO-5 · The evaluation plan: how we will know it is right</h3>\n")
H.append("<p>DO-5 answers \"was it right?\", never \"did it run?\". It has fourteen suites (S1 to S14). The golden tier must be fully green before anything merges or is recorded. The coverage tier (the full 47-lesson run, the seeded-error run, the held-out comparison) is expected to show some failures and reports them with n. Thresholds were written before the first run. Safety checks are floored at 1.00, never averaged.</p>\n")
H.append(render(sec(DO5, "Acceptance conditions", 2), drop=()))
H.append("<h3>DO-6 and DO-7 · Observability and metrics</h3>\n")
H.append("<p>DO-6 lists 45 workflows (WF-1…WF-45), each with the records it must leave behind and a test that proves it. Everything is correlated by one <code>run_id</code> minted when a run starts, so \"why did Lesson 22 fail?\" is one query over <code>model_call</code>. Telemetry stays in our own Postgres (PD-19); no hosted tracing vendor sees lesson content. Four checks make a missing record visible: sums must match, every terminal job has its calls, every store has its check, every process says it started. DO-7 holds 44 metrics. M-1 is the north star: the median active review minutes per approved lesson, shown with n.</p>\n")
H.append('<p class="src">Links: <a href="../design/observability.md">observability</a> · <a href="../design/metrics-registry.md">metrics registry</a>.</p>\n')
H.append("</section>\n")

# reviews
H.append(section_open("reviews", "Reviews and the dry run",
                      "Two checks tried to break the design before any ticket was cut: a design reviewer, and an agent that tried to write tests from the design alone."))
H.append(statusline("fact", "Both reports exist and are linked. Their verdict lines are quoted as filed."))
H.append("<h3>The code-design review (Metz, 2026-10-25): verdict FAIL as filed, three blocking findings</h3>\n")
H.append("<p>The reviewer's story: the module boundaries were mostly right, but the wave table and a few shared files would make parallel tickets collide or wait. The file still reads FAIL. DO-3 and DO-4 now carry the fixes (checked on this page against DO-3 §4 and §5 and DO-4 §3 and §7). <strong>No second review pass is recorded</strong>, and the project checklist requires a PASS before the gate.</p>\n")
H.append(table_html([
    ["ID", "Kind", "Finding", "Where the fix lands"],
    ["B1", "Blocking", "Waves did not follow the dependency order: wave-1 checks called wave-2 repositories; wave 2 hung on one area", "DO-3 §4 re-tabled: new areas A9a, A12a, A13a; repositories moved a wave earlier"],
    ["B2", "Blocking", "Package manifests, the lockfile and the composition roots had no owner", "A0 owns every manifest, tsconfig, lockfile and lint config; per-area wiring files"],
    ["B3", "Blocking", "SP-2\'s result was not carried into DO-3/DO-4", "Fallback deleted; DO-3 §5 says \"do not build\"; DO-4 adds the guard and <code>refused_from</code>; editor module <code>refusals.ts</code>"],
    ["S1", "Should", "Services depended on the concrete database class", "<code>TxRunner</code> port cut (DO-3 §5)"],
    ["S2", "Should", "The store transaction wrote three other areas\' tables in its own SQL", "<code>PgLessonDocStore</code> calls the owners\' functions (DO-3 §4, area A11a)"],
    ["S3", "Should", "One 16-method lesson repository for six areas", "Split by caller (DO-3 §5)"],
    ["S4", "Should", "Typed settings disagreed with DO-3 §7 and over-shared secrets", "<code>ModelSettings</code> now only for web and worker (DO-3 §2.1, §7); field-by-field not re-checked here"],
    ["S5", "Should", "One append-only ports file for every port", "One port per file (DO-3 §5)"],
    ["S6", "Should", "The money protocol repeated in five callers", "<code>PaidCaller</code> cut (DO-3 §5)"],
    ["C1–C4", "Could", "Check registry stubs, <code>ApproveService</code> split, editable-state list, dead rule references", "C1–C3 in DO-3 §5; C4 not verified here"],
]))
H.append("<p>What the reviewer praised, and said to keep: every outside system sits behind one adapter with a real second implementation; the pure core is real; one place builds check context for three callers; one store transaction and one owner of the schema; the deferred list is honest.</p>\n")
H.append("<h3>The spec dry run: 29 gaps found, 29 closed</h3>\n")
H.append("<p>An agent wrote acceptance criteria for three tickets (the spend reservation service, the Approve route with the Submit freeze, and the lesson-draft job step) using only the design documents. Every fact it could not find is a gap. <strong>Result as filed:</strong> 29 gaps found, 29 closed, 0 open, and the signature check passes. The agent ran on Opus 5.5. Each gap, in the agent\'s words, and where it was closed, is in the <a href=\"../design/spec-dry-run.md\">source table</a>.</p>\n")
H.append("</section>\n")

# unknowns
H.append(section_open("unknowns", "What is not known",
                      "Honest gaps. None is hidden in a number above; each is named with what would settle it."))
UNK = [
    ("No load test has run", "Every interactive figure (CPU, connections, event-loop lag, the 3.4 s trace) is [A] or [C on A]. The 200-user script on the VPS, with the model stubbed, measures them. Who closes it: Stage 8 (WF-29)."),
    ("Store timing is from PGlite, not Postgres", "SP-2\'s 25.1 ms p95 ran on an in-process stand-in for Postgres, with Node clients instead of browsers and the blocking checks stubbed. The R-57 probe re-measures on real Postgres."),
    ("Three real drafts only", "SP-1 and SP-3 each used three real drafts. SP-1 tuned its length instruction on those same rows, so the golden suite must use other rows for the length claim. Each SP-3 flag on a real draft is an upper bound until a person labels it (row 9\'s \"Persephone\" may be a real invention)."),
    ("Draft quality is not measured", "The spikes check shape, time, cost and invented text, not whether the teaching is good. Only the approver\'s rating (S13) and the optional judge touch that. No Newsela review-time baseline exists (AQ-14), so most metrics read \"none yet\"."),
    ("DO-1 and DO-2 still carry pre-spike numbers", "DO-1 was written while the spikes ran and still says \"running now\". The comparison table above shows the differences; the source documents should be refreshed before sign-off. Who closes it: the System-track session."),
    ("The contract timing row is stale", "INTERFACE.md\'s timing table still shows the 25-user remote-edit figure (< 300 ms); the capacity doc says < 500 ms at 200 users (readiness gap CG-2). SERVICE_BUSY (CG-1) is already in the shared error table."),
]
H.append('<div class="grid three">')
for t, b in UNK:
    H.append(f'<article class="card" data-status="unknown"><h3>{t} <span class="st unknown">Unknown</span></h3><p>{b}</p></article>')
H.append("</div>\n</section>\n")

# asks


def ask(aid, title, context, problem, whyhard, whyasked, options, rec, decision):
    h = f'<article class="card ask" data-status="awaiting" data-ask="{aid}" id="{aid.lower()}"><h3>{aid} · {title} <span class="st awaiting">Awaiting approval</span></h3>\n'
    h += f'<div class="part" data-part="context"><h3>Where this comes up in the project</h3><p>{context}</p></div>\n'
    h += f'<div class="part" data-part="problem"><h3>The problem we\'re solving</h3><p>{problem}</p></div>\n'
    h += f'<div class="part" data-part="why-hard"><h3>Why it\'s hard</h3><p>{whyhard}</p></div>\n'
    h += f'<div class="part" data-part="why-asked"><h3>Why we\'re asking you, and what your answer changes</h3><p>{whyasked}</p></div>\n'
    h += '<div class="opts">'
    for i, (name, what, conseq, trade) in enumerate(options):
        h += f'<div class="opt{" rec" if i == rec else ""}"><h4>{name}{" · recommended" if i == rec else ""}</h4><p>{what}</p><p><strong>If you pick it:</strong> {conseq}</p><p><strong>Tradeoff:</strong> {trade}</p></div>'
    h += f'</div><p class="decision-line"><strong>Decision needed:</strong> {decision}</p></article>\n'
    return h


H.append(section_open("asks", "Open items for you",
                      "Five choices that are still yours. Each one tells the story first, then says why it is being asked. Where you say nothing, the recommended option stands because of PD-32, and anything you raise reopens it."))
H.append(ask("Q-1", "Where do the checks run?",
             "Reviewer Mira deletes the only checking item for RL.6.6 in Lesson 4 while two colleagues type in the same lesson. Within 5 seconds the issue list must say \"RL.6.6 has no checking item\" (R-28), because Submit stays off while a blocking issue is open.",
             "Decide which program runs the checks after each store: the worker (A), or the same collaboration program that carries everyone\'s typing (B).",
             "The collaboration program has one thread, like one cashier serving 140 people. Broadcasting keystrokes plus saving costs about 0.2 of a core. A check at the guessed 50 ms adds 0.25 and fills about 0.45; at 150 ms it adds 0.75 and fills about 0.95 [C on A]. At that point everyone\'s typing queues behind check runs. We do not yet know the real check time (an [A]).",
             "Four tickets build on the answer: the check runner, the store transaction, the collab server and the issue list. If we build with B and the checks turn out slow, we rebuild the store and the pending flag in CON-13. It is cheap to change now and costly after wave 2.",
             [("A · Worker runs checks", "the store writes one check_job row; the worker claims it.", "typing is protected; about 0.5 s of claim delay; one more small table.", "slower by a half-second; safer under load."),
              ("B · Collab runs checks", "checks run inside the collab program.", "no queue, so the pending flag comes from memory; fewer moving parts.", "loses the headroom the 200-user target needs.")],
             0, "Should the checks run in the worker (A) or inside the collaboration server (B)?"))
H.append(ask("Q-2", "Which model repairs a failed draft?",
             "In SP-1, Lesson 5 (a writing lesson, row 9) came back from the model failing the schema check. One repair call fixed it, and the lesson cost $0.2573 in all. Lesson 25 needed the same. That repair ran on the same strong model that wrote the draft.",
             "Decide whether the repair call uses the same model as the draft, or the cheaper model your earlier decision (PD-12) names.",
             "A repair rewrites a roughly 11,000-token JSON lesson so it passes the checks. A cheaper model may fail more often, and then a lesson ends as <code>generation_failed</code> and a reviewer must fix it by hand, which costs far more than the saving. SP-1 did not price the repair apart from the draft, so the saving is unknown.",
             "PD-12 is your recorded decision and SP-1 departed from it. The answer sets the default <code>MODEL_REPAIR_ID</code> and the price table the spend reservation reads. The change is one setting, so it is cheap to reverse.",
             [("A · Same model until §9 measures it", "keep Sonnet 5.5 for repairs, as SP-1 proved.", "DO-3\'s settings already default all three model ids to it; the evaluation run compares repair models later.", "may overpay a few dollars per run."),
              ("B · Cheaper model now", "follow PD-12 as written.", "set <code>MODEL_REPAIR_ID</code> to the cheaper model before the full run.", "untested in SP-1; a failed repair costs a lesson.")],
             0, "Should repairs run on the same model as drafts (A) or on the cheaper model PD-12 names (B)?"))
H.append(ask("Q-3", "How does the optional judge reach a second provider?",
             "Cut #2 is an optional step that asks a different company\'s model one yes-or-no question per activity: does it teach this standard? Its answer is advice for the reviewer and can never block Approve (R-23). The judge may never be built.",
             "Decide how the judge reaches that second provider: an OpenAI model through OpenRouter, or OpenAI directly.",
             "A judge on the writer\'s own model shares its blind spots, so it must be another provider. But every extra vendor is another place data leaves, and the shared key launcher holds exactly two keys, Anthropic and OpenRouter. A direct OpenAI call would need a new key path.",
             "It only matters if cut #2 survives the cut order. If it does, option A needs one adapter and no new key; option B needs a new adapter, a new key and a change to the credentials rule. The cost of deciding late is small.",
             [("A · OpenRouter", "an OpenAI model reached through OpenRouter.", "one key we already manage; the served model is recorded per call.", "a second vendor in the trust boundary."),
              ("B · OpenAI direct", "call OpenAI\'s API.", "new key and adapter.", "breaks the two-key rule.")],
             0, "If the judge is built, should it go through OpenRouter (A) or OpenAI directly (B)?"))
H.append(ask("Q-4", "Should a possibly invented name block Approve?",
             "SP-3 ran the name scan over Lesson 5. The simple version flagged 24 words, such as \"Prompt\", \"Reviewer\" and \"Shared\", that were only capitalised because they began a list item. One flag, \"Persephone\", may be a real invention. The second version (with a language library) flagged 12 in all, and 0 inside check items.",
             "Decide where a name the lesson\'s sources do not give is allowed to stop a reviewer: everywhere, only inside check items, or nowhere.",
             "A flag that blocks must be right almost every time, or reviewers learn to override it. Check items are where an invented name does the most harm (it teaches a wrong answer), and that is where the second version raised no false flags. Elsewhere, it flags many ordinary words.",
             "This sets how often a reviewer meets a block they must clear, which feeds the north star (minutes per lesson that reaches approval). It changes R-19\'s wording and one constant in the check policy. CON-13 already states \"until then it blocks in check items\", so no contract change is needed.",
             [("A · Block everywhere", "any unknown capitalised word blocks.", "30, 24, 8 and 3 false flags per lesson (simple version).", "unusable; fails SP-3\'s pass line."),
              ("B · Block in check items; advise elsewhere", "the SP-3 result.", "0 false flags in check items; the reviewer sees the rest as a hint.", "a name invented outside a check item is only a hint."),
              ("C · Drop the name scan", "rely on the reviewer.", "no flags at all.", "lets an invented character through.")],
             1, "Should the name scan block only inside check items (B), block everywhere (A), or be dropped (C)?"))
H.append(ask("Q-5", "Deploy to a public URL, or keep the demo local?",
             "The demo is recorded on a Mac under Docker Compose, which costs nothing. The files for a Render deploy (two Dockerfiles and <code>render.yaml</code>) are committed but not switched on. The deadline is Tuesday 2026-10-27, 03:00 CT [F].",
             "Decide whether to spend about $20 a month on a public deploy, or stay with the local recording.",
             "The brief lists source, documentation and a video, and does not ask for a URL, but the partner has not been asked (the question AQ-17 is drafted, not sent, PD-24). A new service also counts toward your $40-a-month Render ceiling across all projects. Anyone clicking a link would meet a maintenance-mode risk and the load numbers we have not measured.",
             "It decides whether the last day goes to a deploy, a health check and an environment group, or to the full run, the eval report and the video. It is reversible: the files are ready.",
             [("A · Stay local", "record under Compose; keep the Render files ready.", "$0 hosting; the last day goes to the run and the video.", "nothing public to click."),
              ("B · Deploy to Render", "about $20 a month [C], not yet priced against the cap.", "a link in the submission; costs time and money.", "needs your OK on the spend.")],
             0, "Should the submission stay local (A) or deploy to Render (B)?"))
H.append("</section>\n")

# approval
H.append('<section aria-labelledby="ask-h" id="approval">\n<div class="ask" data-status="awaiting">\n')
H.append('<h2 id="ask-h">What you are asked to review now</h2>\n')
H.append('<p><span class="st awaiting">Awaiting approval</span> <strong>Stage 6 gate:</strong> please read <a href="../design/system-design.md">DO-1</a> and <a href="../design/architecture.md">DO-2</a>, with this page as your map, and the three spike results: <a href="../analysis/spikes/SP-1-one-call-draft.md">SP-1</a>, <a href="../analysis/spikes/SP-2-freeze-at-submit.md">SP-2</a>, <a href="../analysis/spikes/SP-3-invention-scans.md">SP-3</a>. Then answer the five open items above (Q-1…Q-5, one answer each), and tell us to approve the §6 gate or send it back.</p>\n')
H.append('<p><strong>Why we ask now.</strong> Every backend, frontend and integration ticket needs this gate before it starts (checklist §6). The design stood on your standing authorization (PD-32) so the work could move. This is the first time you see it, so anything you raise reopens the row it touches.</p>\n')
H.append('<p><strong>Approving it would mean:</strong> the system shape in DO-1 and DO-2 is the one the tickets are cut from; the three spike outcomes (including the prompt-embedded schema, the six-in-flight cap and the $13 run cap) stand; and your answers to Q-1…Q-5 are recorded. <strong>It would not</strong> approve: any load number (no load test has run), draft quality, a hosting spend, or the code-design review (still FAIL as filed with no second pass recorded). Not yet approved.</p>\n')
H.append('<p class="src">Also still open on the checklist (not yours): re-run the code-design review to a PASS; refresh DO-1 and DO-2 with the measured numbers; run the signature check once more after the refresh.</p>\n')
H.append("</div>\n</section>\n")
H.append("</main>\n")
H.append('<footer class="wrap">Local file, not published. The Markdown sources are the source of truth; this page is a synthesis built after them. If a source changes, the page is rebuilt with <code>docs/artifacts/_build/system-design/build_system_design.py</code>, stamped and checked with the zero-to-hero <code>check_review_page.py</code> before any sign-off.</footer>\n</body>\n</html>\n')

OUT.write_text("".join(H), encoding="utf-8")
print("wrote", OUT, f"{len(''.join(H)):,} bytes")
