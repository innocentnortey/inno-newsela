"""Build the D4 · Warm Workroom look sheet (UX-2, a static look before any prototype).

Copied from the ux-pipeline starter (templates/look_sheet_generator.py) and filled in, 2026-10-25.
Run:     python3 docs/artifacts/_build/d4-look/build_d4_look.py
Writes:  docs/artifacts/2026-10-25-d4-warm-workroom-look-sheet.html (static, offline, images embedded)

Same four screens (M1-M4) and the same words as the D1-D3 sheets: every visible line comes from
docs/ux/02-concepts/LOOK_SHEET_COPY.md. Construction follows the D4 component anatomy table in
docs/design/DESIGN-DIRECTIONS.md. Palette values are a proposal; UX-3 design.md makes them exact.
The build exits 1 (and writes nothing) if any text pair is under 4.5:1 or any UI edge under 3:1.
Reference shots are downscaled with macOS `sips` (<= 900 px wide, JPEG q80) into a scratch folder
(env D4_SCRATCH, else a temp dir); without `sips` the originals are embedded as they are.
"""
import base64
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
DOCS = HERE.parents[2]  # docs/
REFS = DOCS / "design" / "references"

# ---------------------------------------------------------------- FILL 1: identity
DIRECTION = "D4"
NAME = "Warm Workroom"
INTENT = "A well-run workshop: the numbers and the trail are always visible."
DATE = "2026-10-25"
OUT = DOCS / "artifacts" / f"{DATE}-d4-warm-workroom-look-sheet.html"

# ---------------------------------------------------------------- FILL 2: credited references
# (file, title, designer, url, why kept [REFERENCES.md], feel-brief line it serves)
SHOTS = [
    ("d4-01-geo-data-validation.jpg", "Geo-data validation &amp; verification", "Joakim Ljungren",
     "https://dribbble.com/shots/26850562-Geo-data-validation-verification",
     "Import table: error rows tinted, banners with counts", "evidence visible; dense where scanning"),
    ("d4-02-file.jpg", "File import control with data mapping", "Autentika",
     "https://dribbble.com/shots/26979291-File-import-control-with-data-mapping-Elmark",
     "Import progress card and four stat tiles", "accountable"),
    ("d4-03-adminflow-multi-tier-approval-workflow-a.jpg",
     "AdminFlow Multi-Tier Approval Workflow &amp; Administrative Request", "Alvin R",
     "https://dribbble.com/shots/27442499-AdminFlow-Multi-Tier-Approval-Workflow-Administrative-Request",
     "Multi-step approval: step header, approval history timeline, Approve / Request changes", "accountable"),
    ("d4-04-wooden-style-dashboard-design-in-figma-u.jpg", "Wooden-Style Dashboard Design in Figma | UI/UX Design",
     "Abdul Rehman Waseem",
     "https://dribbble.com/shots/26495903-Wooden-Style-Dashboard-Design-in-Figma-UI-UX-Design",
     "Walnut sidebar and banded table header", "warm"),
    ("d4-05-crm-unified-inbox-ui-email-management-fo.jpg",
     "CRM Unified Inbox UI Email Management for Sales Teams | Closr", "Filllo - SaaS Design Agency",
     "https://dribbble.com/shots/27322893-CRM-Unified-Inbox-UI-Email-Management-for-Sales-Teams-Closr",
     "Dense inbox rows with coloured tags", "dense where scanning"),
    ("d4-06-vehicle-management-built-for-fleet-saas-.jpg", "Vehicle Management Built for Fleet SaaS Ops | Movex",
     "Filllo - SaaS Design Agency",
     "https://dribbble.com/shots/27360346-Vehicle-Management-Built-for-Fleet-SaaS-Ops-Movex",
     "Fleet table with column manager", "dense where scanning"),
]

# ---------------------------------------------------------------- FILL 3: palettes
# Seeds from DESIGN-DIRECTIONS.md (D4 light / D4 dark): ground, panel, well, ink, ink2, primary, sidebar.
# Every other token is added here at the same temperature. Changes to seed values: none needed (see CHANGES).
LIGHT = {
    "ground": "#FFFFFF", "panel": "#FFFFFF", "well": "#F3F1EE", "hair": "#E6E0DA", "edge": "#8E8279",
    "ink": "#231F1C", "ink2": "#5E5650", "primary": "#B4410F", "on-primary": "#FFFFFF", "primary-tint": "#FBEDE5",
    "danger": "#B0223A", "on-danger": "#FFFFFF", "err-tint": "#FCEEF0",
    "warn": "#8A5200", "warn-tint": "#FDF3DF", "ok": "#1D7442", "ok-tint": "#E8F4EC",
    "walnut-ink": "#5C4033", "walnut-tint": "#F2E9E3",
    "sidebar": "#4A332B", "sidebar-ink": "#F6EEE8", "sidebar-ink2": "#CDB9AD", "sidebar-sel": "#F1E2D8",
    "sidebar-sel-ink": "#3A2820", "band": "#5C4033", "on-band": "#FFFFFF",
    "tag-read": "#E8EAF7", "tag-read-ink": "#36398A", "tag-write": "#F6E8F0", "tag-write-ink": "#7A2C5A",
    "tag-flex": "#E3EFF3", "tag-flex-ink": "#1E5566",
}
DARK = {
    "ground": "#1A1714", "panel": "#221E1A", "well": "#2B2621", "hair": "#3A332D", "edge": "#857970",
    "ink": "#F1ECE6", "ink2": "#BDB3A8", "primary": "#F08A5D", "on-primary": "#24110A", "primary-tint": "#3D2A21",
    "danger": "#FF8D97", "on-danger": "#2A0B0F", "err-tint": "#3A1F23",
    "warn": "#F0BD6A", "warn-tint": "#342918", "ok": "#7FD39B", "ok-tint": "#1B2E22",
    "walnut-ink": "#E5CBBB", "walnut-tint": "#3A2C25",
    "sidebar": "#2A1E19", "sidebar-ink": "#F1E6DE", "sidebar-ink2": "#BFA899", "sidebar-sel": "#4A352C",
    "sidebar-sel-ink": "#F6ECE5", "band": "#8E6250", "on-band": "#FFFFFF",
    "tag-read": "#2A2C48", "tag-read-ink": "#C6CAF6", "tag-write": "#3A2232", "tag-write-ink": "#F2C0DD",
    "tag-flex": "#1C3138", "tag-flex-ink": "#A8D9E6",
}
CHANGES = ("One added token was lifted to pass: the dark walnut band started at #3B2A22 (1.21:1 against the dark panel, so the "
           "banded header vanished) and is now #8E6250, same hue, {band}:1. No seed hex from DESIGN-DIRECTIONS.md changed.")

# Text pairs (fg, bg) that occur in the mockups. All must reach 4.5:1.
PAIRS = [
    ("ink", "ground"), ("ink", "panel"), ("ink", "well"), ("ink", "primary-tint"), ("ink", "err-tint"),
    ("ink", "warn-tint"), ("ink", "ok-tint"),
    ("ink2", "ground"), ("ink2", "panel"), ("ink2", "well"), ("ink2", "err-tint"), ("ink2", "warn-tint"),
    ("primary", "panel"), ("primary", "primary-tint"), ("on-primary", "primary"),
    ("danger", "panel"), ("danger", "err-tint"), ("on-danger", "danger"),
    ("warn", "warn-tint"), ("warn", "panel"), ("ok", "ok-tint"), ("ok", "panel"),
    ("walnut-ink", "walnut-tint"), ("on-band", "band"),
    ("sidebar-ink", "sidebar"), ("sidebar-ink2", "sidebar"), ("sidebar-sel-ink", "sidebar-sel"),
    ("tag-read-ink", "tag-read"), ("tag-write-ink", "tag-write"), ("tag-flex-ink", "tag-flex"),
]
# Non-text UI parts (control edges, focus/selection rings, status glyphs) need 3:1 against their surface.
UI_PAIRS = [
    ("edge", "panel"), ("primary", "panel"), ("danger", "panel"), ("danger", "err-tint"),
    ("warn", "warn-tint"), ("ok", "panel"), ("band", "panel"), ("primary", "sidebar-sel"),
]

# ---------------------------------------------------------------- icons
def ico(path, size=16, sw=1.8):
    return (f"<svg class='i' width='{size}' height='{size}' viewBox='0 0 24 24' fill='none' stroke='currentColor' "
            f"stroke-width='{sw}' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>{path}</svg>")


def glyph(inner, size=16):
    return f"<svg class='g' width='{size}' height='{size}' viewBox='0 0 16 16' aria-hidden='true'>{inner}</svg>"


I_BOARD = ico("<rect x='3.5' y='4' width='7' height='16' rx='1.5'/><rect x='13.5' y='4' width='7' height='9' rx='1.5'/>")
I_UPLOAD = ico("<path d='M12 15V4M7.5 8.5 12 4l4.5 4.5'/><path d='M4 15v4.5h16V15'/>")
I_DOCS = ico("<path d='M7 3.5h7l4 4v13H7z'/><path d='M14 3.5v4h4M10 12h5M10 15.5h5'/>")
I_STAMP = ico("<path d='M9.5 11V7a2.5 2.5 0 0 1 5 0v4'/><path d='M5 14.5h14V18H5z'/><path d='M7 21h10'/>")
I_FILE = ico("<path d='M6 3.5h8l4 4v13H6z'/><path d='M14 3.5v4h4'/><path d='M9 13l2 2 4-4'/>", 18)
I_SHEET = ico("<rect x='4' y='4' width='16' height='16' rx='2'/><path d='M4 9.5h16M4 15h16M10 4v16'/>", 18)
I_CAL = ico("<rect x='3.5' y='5' width='17' height='15' rx='2'/><path d='M3.5 10h17M8 3v4M16 3v4'/>", 18)
I_TAG = ico("<path d='M3.5 12.5V4h8.5l8.5 8.5-8 8z'/><circle cx='8' cy='8.5' r='1.3'/>", 18)
I_LINKX = ico("<path d='M9.5 14.5l5-5'/><path d='M11 6.5l1.5-1.5a3.5 3.5 0 0 1 5 5L16 11.5M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5'/><path d='M4 4l16 16'/>", 18)
I_CHEV = ico("<path d='M9 6l6 6-6 6'/>", 14)
I_DOWN = ico("<path d='M6 9l6 6 6-6'/>", 14)
I_SORT = ico("<path d='M7 4v16M7 20l-3-3M7 20l3-3M14 6h7M14 11h5M14 16h3'/>", 14)
I_SEARCH = ico("<circle cx='11' cy='11' r='6.5'/><path d='M20 20l-4.2-4.2'/>", 15)
I_LOCK = ico("<rect x='5' y='11' width='14' height='9.5' rx='2'/><path d='M8 11V8a4 4 0 0 1 8 0v3'/>", 14)
I_QUOTE = ico("<path d='M5 17.5c0-4 1-7 4.5-9M13.5 17.5c0-4 1-7 4.5-9'/><path d='M4.5 13.5h4.5v4.5H4.5zM13 13.5h4.5v4.5H13z'/>", 18)
I_LINK = ico("<path d='M10 14l4-4'/><path d='M11 6.5l1.5-1.5a3.5 3.5 0 0 1 5 5L16 11.5M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5'/>", 16)
I_USER = ico("<circle cx='12' cy='8.5' r='3.5'/><path d='M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5'/>", 16)
I_EYES = ico("<circle cx='10' cy='8.5' r='3.5'/><path d='M3.5 20c.7-3.4 3.3-5.3 6.5-5.3 1.2 0 2.3.3 3.2.8'/><path d='M15 18l2 2 4-4.5'/>", 16)
I_CLOCK = ico("<circle cx='12' cy='12' r='8.5'/><path d='M12 7.5V12l3 2'/>", 14)
I_BOOK = ico("<path d='M4 5.5A2 2 0 0 1 6 4h13v14H6a2 2 0 0 0-2 2z'/><path d='M4 20V5.5'/>", 14)
TB = "".join(ico(p, 15) for p in (
    "<path d='M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z'/>",
    "<path d='M14 5h-4M14 19h-4M13 5l-2 14'/>",
    "<path d='M9 6.5h11M9 12h11M9 17.5h11'/><circle cx='4.5' cy='6.5' r='.6'/><circle cx='4.5' cy='12' r='.6'/><circle cx='4.5' cy='17.5' r='.6'/>",
    "<path d='M10 14l4-4'/><path d='M11 6.5l1.5-1.5a3.5 3.5 0 0 1 5 5L16 11.5M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5'/>",
    "<path d='M5 17.5c0-4 1-7 4.5-9M13.5 17.5c0-4 1-7 4.5-9'/>",
))

# Status glyphs: shape carries the meaning, colour only reinforces it.
G_ERR = glyph("<circle cx='8' cy='8' r='7.2' style='fill:currentColor'/><path d='M8 4.3v4.4' style='stroke:var(--on-danger);stroke-width:1.9;stroke-linecap:round'/><circle cx='8' cy='11.4' r='1.05' style='fill:var(--on-danger)'/>")
G_WARN = glyph("<path d='M8 1.4 15.2 14.2H.8z' style='fill:currentColor;stroke:currentColor;stroke-linejoin:round;stroke-width:1'/><path d='M8 6v3.6' style='stroke:var(--panel);stroke-width:1.8;stroke-linecap:round'/><circle cx='8' cy='11.8' r='.95' style='fill:var(--panel)'/>")
G_OK = glyph("<circle cx='8' cy='8' r='7.2' style='fill:currentColor'/><path d='M4.8 8.2l2.2 2.2 4.3-4.6' style='fill:none;stroke:var(--panel);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round'/>")
G_INFO = glyph("<circle cx='8' cy='8' r='6.6' style='fill:none;stroke:currentColor;stroke-width:1.6'/><path d='M8 7.3v4' style='stroke:currentColor;stroke-width:1.7;stroke-linecap:round'/><circle cx='8' cy='4.9' r='.95' style='fill:currentColor'/>")
S_DRAFT = glyph("<circle cx='8' cy='8' r='6' style='fill:none;stroke:currentColor;stroke-width:1.6;stroke-dasharray:2.4 2'/>", 14)
S_REVIEW = glyph("<circle cx='8' cy='8' r='6' style='fill:none;stroke:currentColor;stroke-width:1.6'/><path d='M8 2a6 6 0 0 1 0 12z' style='fill:currentColor'/>", 14)
S_SUB = glyph("<circle cx='8' cy='8' r='6' style='fill:none;stroke:currentColor;stroke-width:1.6'/><circle cx='8' cy='8' r='2.6' style='fill:currentColor'/>", 14)
S_APP = glyph("<circle cx='8' cy='8' r='6.8' style='fill:currentColor'/><path d='M5 8.2l2 2 4-4.3' style='fill:none;stroke:var(--panel);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round'/>", 14)
S_FAIL = glyph("<rect x='1.5' y='1.5' width='13' height='13' rx='3' style='fill:currentColor'/><path d='M5.5 5.5l5 5M10.5 5.5l-5 5' style='stroke:var(--panel);stroke-width:1.7;stroke-linecap:round'/>", 14)
S_EXP = glyph("<circle cx='8' cy='8' r='6' style='fill:none;stroke:currentColor;stroke-width:1.6'/><path d='M6 10l4-4M7 6h3v3' style='fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round'/>", 14)

STATE = {
    "Draft": ("st-draft", S_DRAFT), "In review": ("st-review", S_REVIEW), "Submitted": ("st-sub", S_SUB),
    "Approved": ("st-app", S_APP), "Failed": ("st-fail", S_FAIL), "Exported": ("st-draft", S_EXP),
}


def st(name):
    cls, g = STATE[name]
    return f"<span class='st {cls}'>{g}{name}</span>"


def typetag(t):
    cls = {"Reading": "tt-read", "Writing": "tt-write", "Flex Day": "tt-flex"}[t]
    return f"<span class='tt {cls}'>{t}</span>"


# ---------------------------------------------------------------- shared frame parts
def sidebar(active, who, role, initials):
    items = [("Unit board", I_BOARD, "47"), ("Outline import", I_UPLOAD, ""), ("Lessons", I_DOCS, ""),
             ("Approvals", I_STAMP, "2")]
    nav = "".join(
        f"<span class='nv{' on' if n == active else ''}'>{i}<b>{n}</b>{f'<em class=num>{c}</em>' if c else ''}</span>"
        for n, i, c in items)
    return f"""<aside class="sb"><div class="brand"><span class="logo" aria-hidden="true">{ico("<path d='M5 4.5h9l5 5v10H5z'/><path d='M9 13.5h6M9 17h4'/>", 15, 2)}</span><b>Lesson Studio</b></div>
<div class="ctx"><small>Grade 6 · Unit 4</small><b><i>The Lightning Thief</i></b></div>
<nav>{nav}</nav>
<div class="me"><span class="av">{initials}</span><div><b>{who}</b><small>{role}</small></div></div></aside>"""


def steps(current):
    names = ["Draft", "In review", "Submitted", "Approved", "Exported"]
    k = names.index(current)
    out = []
    for n, name in enumerate(names):
        cls = "done" if n < k else ("cur" if n == k else "todo")
        dot = (ico("<path d='M5 12.5l4.5 4.5L19 7.5'/>", 12, 2.6) if cls == "done" else f"<span class='num'>{n + 1}</span>")
        out.append(f"<li class='{cls}'><span class='dot'>{dot}</span><b>{name}</b>{'<small>Current</small>' if cls == 'cur' else ''}</li>")
    return f"<ol class='steps'>{''.join(out)}</ol>"


def tile(value, label, icon, tone=""):
    return (f"<div class='tile {tone}'><div><b class='num'>{value}</b><span>{label}</span></div>"
            f"<span class='ti'>{icon}</span></div>")


# ---------------------------------------------------------------- FILL 4: mockups (copy: LOOK_SHEET_COPY.md)
def act(primary="Confirm"):
    return f"<span class='acts'><span class='btn sm pri'>{primary}</span><span class='btn sm'>Edit</span></span>"


def seg(options, on):
    return "<span class='seg'>" + "".join(
        f"<span class='{'on' if o == on else ''}'>{o}{' <small>default</small>' if o == on else ''}</span>" for o in options) + "</span>"


M1 = f"""<div class="frame">{sidebar("Outline import", "A. Chen", "Outline author", "AC")}
<div class="work">
 <header class="top"><div class="crumb">Grade 6 {I_CHEV} Unit 4 {I_CHEV} <i>The Lightning Thief</i></div>
  <div class="tr"><span class="file">{I_SHEET}<code>g6-u4-outline.xlsx</code><small>uploaded by A. Chen</small></span></div></header>
 <div class="pad">
  <div class="titlerow"><div><h2>Outline v1</h2><p class="sub">Validation report · Grade 6 · Unit 4 · <i>The Lightning Thief</i></p></div></div>
  <div class="tiles">{tile("47", "teaching days", I_CAL)}{tile("5", "errors to confirm", G_ERR, "t-err")}{tile("7", "ELD labels flagged", I_TAG, "t-warn")}{tile("2", "bad filenames", I_LINKX, "t-warn")}</div>
  <div class="banner b-err">{G_ERR}<b><span class="num">5</span> errors to confirm</b><span class="sep">·</span><span><span class="num">7</span> ELD labels flagged</span><span class="sep">·</span><span><span class="num">2</span> bad filenames</span><span class="bsum"><span class="num">47</span> teaching days</span></div>
  <table class="grid">
   <thead><tr><th class="c-ic"></th><th style="width:178px">Where</th><th>Finding</th><th style="width:250px">Proposed</th><th class="c-act">Action</th></tr></thead>
   <tbody>
    <tr class="r-err"><td class="c-ic">{G_ERR}</td><td><b>Unit</b></td><td>The sheet says <b>G6, U4</b>; every filename says <b>U3</b>.</td><td>Confirm <b>U4</b></td><td>{act()}</td></tr>
    <tr class="r-err"><td class="c-ic">{G_ERR}</td><td><b>Row <span class="num">8</span></b> · Lesson 4 · Focus</td><td><code>RL.6.1, 6.2 L.6.4</code> — "6.2" has no strand.</td><td>Proposed: <code>RL.6.1 · RL.6.2 · L.6.4</code></td><td>{act()}</td></tr>
    <tr class="r-err"><td class="c-ic">{G_ERR}</td><td><b>Rows <span class="num">30, 34, 39</span></b></td><td><code>RL.6.9.a</code> does not exist.</td><td>Drop it (<code>RL.6.9</code> is already listed)</td><td>{act()}</td></tr>
    <tr class="r-group"><td colspan="5">{G_WARN}<b>Warnings</b><span>each shows its default</span></td></tr>
    <tr class="r-warn"><td class="c-ic">{G_WARN}</td><td>Row <span class="num">8</span> · <i>Foundational Skills</i></td><td>Note: "Instead, think about using morphology…"</td><td colspan="2">{seg(["Apply", "Show to reviewer only", "Ignore"], "Apply")}</td></tr>
    <tr class="r-warn"><td class="c-ic">{G_WARN}</td><td>Row <span class="num">9</span> · <i>Text Set Choice</i></td><td>"WRITER MUST SLECT AND WRITE TO AN EXCERPT OF THE TEXT"</td><td colspan="2">becomes an <b>excerpt slot</b></td></tr>
    <tr class="r-warn"><td class="c-ic">{G_WARN}</td><td>Row <span class="num">9</span> · <i>Vocabulary</i></td><td>"Cap at 6 words per lesson"</td><td colspan="2"><b>unit rule</b> for rows <span class="num">8–23</span></td></tr>
    <tr class="r-warn"><td class="c-ic">{G_WARN}</td><td>Row <span class="num">8</span> · <code>ELD.PII.6.5</code></td><td>Sheet says "Use transitions to connect ideas"; official strand is <i>Modifying to add details</i></td><td colspan="2">{seg(["Keep", "Re-map to PII.6.2b"], "Keep")}</td></tr>
    <tr class="r-warn"><td class="c-ic">{G_WARN}</td><td>Row <span class="num">39</span> · <i>Homework</i></td><td>"Warn students about potentially triggering scene in tonight's reading (references to domestic abuse)"</td><td colspan="2"><span class="btn sm">Confirm as a safety flag</span></td></tr>
    <tr class="r-ok"><td class="c-ic">{G_OK}</td><td>Row <span class="num">10</span> · Lesson 6</td><td><b>OK</b> · <span class="num">0</span> warnings</td><td colspan="2"></td></tr>
   </tbody></table>
 </div>
 <footer class="foot"><span class="why">{G_ERR}Generate stays off: <b>5 errors to confirm</b></span><span class="btn pri dis">{I_LOCK}Generate 47 lessons</span></footer>
</div></div>"""

ROLL = [("Draft", 34), ("In review", 6), ("Submitted", 2), ("Approved", 3), ("Failed", 2)]
ROWS = [
    ("Lesson 4: The Lightning Thief, Chapter 1", "Reading", "In review", "3", "1", "M. Okafor", "Waits on Lesson 5's excerpt"),
    ("Lesson 5: Comparing Percy and Soongoora", "Writing", "Submitted", "0", "2", "J. Rivera", "—"),
    ("Lesson 31: Comparing the Gods' Home", "Writing", "Draft", "2", "2", "—", "Safety flag open"),
    ("Flex Day: Meaning-Making Huddle", "Flex Day", "Draft", "1", "1", "—", "Standard proposed: <code>RL.6.7</code>"),
    ("Lesson 22", "Reading", "Failed", "—", "—", "—", "Truncated · <span class='btn xs'>Retry</span>"),
    ("Lesson 6", "Reading", "Approved", "0", "0", "J. Rivera", "Approved · v2"),
]


def blk(v):
    if v.isdigit() and int(v) > 0:
        return f"<td class='n'><span class='bk'>{G_ERR}<b class='num'>{v}</b></span></td>"
    return f"<td class='n num muted'>{v}</td>"


M2_rows = "".join(
    f"<tr><td><b>{l}</b></td><td>{typetag(t)}</td><td>{st(s)}</td>{blk(b)}<td class='n num'>{a}</td>"
    f"<td>{r}</td><td class='muted'>{n}</td></tr>" for l, t, s, b, a, r, n in ROWS)
M2_bar = "".join(f"<span class='sg sg-{STATE[s][0]}' style='flex:{v}'></span>" for s, v in ROLL)
M2_roll = "".join(f"<div class='rt'><span class='rl'>{st(s)}</span><b class='num'>{v}</b></div>" for s, v in ROLL)
M2_chips = "".join(
    f"<span class='chip{' on' if c == 'All' else ''}'>{c}<em class='num'>{v}</em></span>"
    for c, v in [("All", 47)] + ROLL)

M2 = f"""<div class="frame">{sidebar("Unit board", "You", "Reviewer", "YO")}
<div class="work">
 <header class="top"><div class="crumb">Grade 6 {I_CHEV} Unit 4</div><div class="tr"><span class="search">{I_SEARCH}<span>Search lessons</span></span></div></header>
 <div class="pad">
  <div class="titlerow"><div><h2>Unit 4 · <i>The Lightning Thief</i></h2><p class="sub"><span class="num">47</span> lessons</p></div></div>
  <div class="board-top">
   <div class="card roll"><div class="ch"><b>Roll-up</b><span class="num">47 lessons</span></div>
    <div class="bar" role="img" aria-label="Draft 34, In review 6, Submitted 2, Approved 3, Failed 2">{M2_bar}</div>
    <div class="rts">{M2_roll}</div></div>
   <div class="card ns"><div class="ch"><b>Reviewer minutes per approved lesson</b><span class="star">North star</span></div>
    <div class="nsv"><div><small>median</small><b class="num big">24<span> min</span></b></div><div class="nsn"><span><small>n</small><b class="num">= 3</b></span><span><small>fast approvals</small><b class="num">0 of 3</b></span><span><small>approved</small><b class="num">3 of 47</b></span></div></div>
    <p class="cap">No baseline yet (AQ-14). Measured with us as reviewers.</p></div>
  </div>
  <div class="filters"><div class="chips">{M2_chips}</div><span class="sort">{I_SORT}Sorted by blocking issues</span></div>
  <table class="grid band">
   <thead><tr><th>Lesson</th><th style="width:96px">Type</th><th style="width:120px">State</th><th class="n" style="width:84px">Blocking</th><th class="n" style="width:84px">Advisory</th><th style="width:104px">Reviewer</th><th style="width:212px">Note</th></tr></thead>
   <tbody>{M2_rows}</tbody></table>
 </div>
</div></div>"""

M3_ISSUES = [
    ("b", "Quote placeholder open", "<code>G6.U4.L4.LearningInAction.PartA</code>"),
    ("b", "Homework waits on Lesson 5's excerpt", ""),
    ("b", "<code>L.6.4.b</code> was chosen by the tool — confirm or remove", ""),
    ("a", "<code>ELD.PII.6.5</code> label names another strand", ""),
]
M3_iss = "".join(
    f"<li class='{'blk' if k == 'b' else 'adv'}'>{G_ERR if k == 'b' else G_INFO}<div><span class='sev'>{'Blocking' if k == 'b' else 'Advisory'}</span>"
    f"<b>{t}</b>{f'<small>{s}</small>' if s else ''}</div><span class='go'>{I_CHEV}</span></li>"
    for k, t, s in M3_ISSUES)
M3_STD = [
    ("RL.6.1", "from the outline", "Part A", "Look Back", False),
    ("RL.6.2", "outline, fixed by A. Chen", "Part B", "Pulse Check", False),
    ("L.6.4.b", "<b>chosen by the tool · confirm</b>", "Literacy Lab", "Literacy Lab check", True),
]
M3_std = "".join(
    f"<li class='{'r-conf' if c else ''}'><div class='sr1'>{G_ERR if c else G_OK}<code>{code}</code><span>{src}</span></div>"
    f"<div class='sr2'><span>taught: <b>{t}</b></span><span>checked: <b>{ch}</b></span></div></li>"
    for code, src, t, ch, c in M3_STD)
OUTLINE = [("Launch", "5", "", 0), ("Literacy Lab", "10", "", 0), ("Learning in Action", "30", "", 0),
           ("Part A", "15", "sel", 1), ("Part B", "15", "pres", 1), ("Look Back", "5", "", 0), ("Homework", "", "", 0)]
M3_out = "".join(
    f"<li class='{c}{' sub' if s else ''}'><span>{n}</span>{'<span class=pav title=M.Okafor>MO</span>' if c == 'pres' else ''}"
    f"<em class='num'>{m}</em></li>" for n, m, c, s in OUTLINE)

M3 = f"""<div class="frame">{sidebar("Lessons", "You", "Reviewer", "YO")}
<div class="work">
 <header class="top"><div class="crumb">Unit 4 {I_CHEV} Lessons {I_CHEV} Lesson 4</div>
  <div class="tr"><span class="presence"><span class="pav">MO</span>M. Okafor is editing Part B</span></div></header>
 <div class="lhead"><div><h2>Lesson 4: The Lightning Thief, Chapter 1</h2>
  <p class="meta">{typetag("Reading")}<span>{I_CLOCK}<span class="num">50</span> min</span>{st("In review")}<span class="ver">v3</span></p></div>{steps("In review")}</div>
 <div class="ws">
  <nav class="outline"><h4>Sections</h4><ul>{M3_out}</ul></nav>
  <article class="ed"><div class="tb">{TB}</div>
   <div class="doc">
    <p class="sl">Literacy Lab · <span class="num">10</span> min</p>
    <h3>Introduce New Words Using Morphemes</h3>
    <p class="line"><span class="cue">Say</span><span>"Today we'll use word parts to unlock new words. The root <i>mort-</i> means death."</span></p>
    <p class="line"><span class="cue">Ask</span><span>"If <i>mort</i> means death, what does <i>immortal</i> mean?"</span></p>
    <p class="samp"><i>Sample response:</i> "Not able to die. <i>Im-</i> means not."</p>
    <p class="sl">Learning in Action · Part A: Percy's Voice (RL.6.1, RL.6.4) · <span class="num">15</span> min</p>
    <div class="slot">{I_QUOTE}<div><b>Reviewer to insert:</b> one sentence from Ch. 1, pp. 1–8, where Percy's sarcastic word choice sets the tone
     <p class="slotm"><span class="tagw">rights: <i>short-quote-commentary</i></span><code>G6.U4.L4.LearningInAction.PartA</code></p></div><span class="btn sm pri">Insert quote</span></div>
    <p class="sl pres-line"><span>Learning in Action · Part B · <span class="num">15</span> min</span><span class="caret"><span class="pav">MO</span>M. Okafor is editing Part B</span></p>
   </div></article>
  <aside class="ev"><div class="evh"><b>Evidence</b><span class="tabs"><span class="on">Issues <em class="num">4</em></span><span>Standards <em class="num">3</em></span></span></div>
   <div class="banner b-err tight">{G_ERR}<b>Issues (<span class="num">3</span> blocking, <span class="num">1</span> advisory)</b></div>
   <ol class="issues">{M3_iss}</ol>
   <h5>Standards</h5>
   <ul class="stds">{M3_std}</ul>
   <blockquote class="off"><small>{I_BOOK}Official text of <code>L.6.4.b</code></small>"Use common, grade-appropriate Greek or Latin affixes and roots as clues to the meaning of a word (e.g., audience, auditory, audible)."</blockquote>
  </aside>
 </div>
 <footer class="foot"><span class="why">{G_ERR}<b>3 blocking issues</b><small>Active review time on this lesson is recorded and shown only as unit totals.</small></span><span class="btn pri dis">{I_LOCK}Submit for approval</span></footer>
</div></div>"""

CHECKS = [
    ("Quotes and excerpts", "excerpt inserted by J. Rivera from <i>Zanzibar Tales</i> (Bateman trans.) · rights: public-domain · source recorded"),
    ("Standards taught and checked", "<code>W.6.2.a</code>, <code>W.6.2.b</code>, <code>W.6.2.f</code> confirmed by J. Rivera"),
    ("ELD supports keep the same text and task", ""),
    ("Social content reviewed", ""),
    ("AI-assisted spans", "1 accepted by J. Rivera"),
]
M4_checks = "".join(f"<li>{G_OK}<div><b>{t}</b>{f'<small>{e}</small>' if e else ''}</div></li>" for t, e in CHECKS)
TL = [
    ("done", "Excerpt inserted", "J. Rivera · <i>Zanzibar Tales</i> (Bateman trans.)"),
    ("done", "Standards confirmed", "J. Rivera · <code>W.6.2.a</code> <code>W.6.2.b</code> <code>W.6.2.f</code>"),
    ("done", "AI-assisted span accepted", "J. Rivera · <span class='num'>1</span> span"),
    ("done", "Submitted", "J. Rivera · snapshot <code>9f3c…a21e</code>"),
    ("cur", "Approval", "You · waiting on your decision"),
    ("todo", "Approved", "Pending"),
    ("todo", "Exported", "Pending"),
]
M4_tl = "".join(
    f"<li class='{c}'><span class='nd'>{G_OK if c == 'done' else ''}</span><div><b>{t}</b><small>{s}</small>"
    f"{'<span class=st st-review>' + S_REVIEW + 'In progress</span>' if c == 'cur' else ''}</div></li>" for c, t, s in TL)

M4 = f"""<div class="frame">{sidebar("Approvals", "You", "Approver", "YO")}
<div class="work">
 <header class="top"><div class="crumb">Approvals {I_CHEV} Lesson 5</div><div class="tr"><span class="file">snapshot <code>9f3c…a21e</code></span></div></header>
 <div class="lhead"><div><h2>Lesson 5: Comparing Percy and Soongoora</h2>
  <p class="meta">{typetag("Writing")}{st("Submitted")}<span>by J. Rivera</span><span>snapshot <code>9f3c…a21e</code></span></p></div>{steps("Submitted")}</div>
 <div class="ap">
  <div class="apm">
   <div class="banner b-note">{I_LINK}<span>Lesson 4 is waiting on this lesson's excerpt.</span></div>
   <section class="card"><div class="ch"><b>Checklist</b><span><span class="num">5</span> of <span class="num">5</span> with evidence</span></div><ul class="checks">{M4_checks}</ul></section>
   <div class="banner b-ok">{I_EYES}<span>You did not edit this lesson, so you can approve it.</span></div>
   <section class="card"><div class="ch"><b>Draft quality</b><span class="req">required</span></div>
    <div class="radios"><span><em class="rd"></em>Usable as drafted</span><span class="on"><em class="rd"></em><b>Usable with edits</b></span><span><em class="rd"></em>Rewritten</span></div></section>
   <div class="decide"><span class="btn">Request changes</span><span class="btn pri">{ico("<path d='M5 12.5l4.5 4.5L19 7.5'/>", 15, 2.2)}Approve this version</span></div>
   <p class="fine">Approving pins snapshot <code>9f3c…a21e</code>. If it changes before you approve, you'll be asked to reload.</p>
  </div>
  <aside class="aps"><section class="card"><div class="ch"><b>Approval history</b></div><ol class="tl">{M4_tl}</ol></section>
   <section class="card sum"><div class="ch"><b>Snapshot</b></div>
    <div class="kv"><span>Lesson</span><b>Lesson 5</b></div><div class="kv"><span>Type</span><b>Writing</b></div>
    <div class="kv"><span>State</span><b>{st("Submitted")}</b></div><div class="kv"><span>Submitted by</span><b>J. Rivera</b></div>
    <div class="kv"><span>Snapshot</span><b><code>9f3c…a21e</code></b></div></section></aside>
 </div>
</div></div>"""

MOCKUPS = [
    ("M1 · SCR-4 Validation report", "FLOW-3", "Outline author checks the uploaded sheet before any money is spent. Error rows tinted, an icon in the first column, banners that state counts.", M1),
    ("M2 · SCR-8 Unit board", "FLOW-6", "The unit at a glance: roll-up tiles, the north-star tile with its n, a walnut-banded triage table sorted by blocking issues.", M2),
    ("M3 · SCR-9 Lesson workspace, Lesson 4", "FLOW-7 · WP-1", "The lesson is the work; outline left, evidence right, the blocking count beside the disabled Submit.", M3),
    ("M4 · SCR-14 Approval review, Lesson 5", "FLOW-12 · WP-2", "Horizontal step header, checklist with evidence, and the vertical approval-history timeline.", M4),
]
DARK_MOCKUP = 2  # M3

# ---------------------------------------------------------------- direction CSS (component construction)
CSS = r"""
.frame{width:1200px;min-height:760px;display:grid;grid-template-columns:216px 1fr;background:var(--ground);color:var(--ink);border-radius:8px;overflow:hidden;box-shadow:0 0 0 1px var(--hair),0 18px 40px -24px rgba(40,25,15,.35);font:13.5px/1.45 var(--ui);font-variant-numeric:tabular-nums;text-align:left}
.frame code{font:12px/1.3 ui-monospace,'SF Mono',Menlo,Consolas,monospace;color:inherit;background:var(--well);padding:1px 4px;border-radius:4px;white-space:nowrap}
.frame i{font-style:italic}.frame .num{font-variant-numeric:tabular-nums}
.frame .i{flex:none}.frame .g{flex:none;display:inline-block}
.sb{background:var(--sidebar);color:var(--sidebar-ink);display:flex;flex-direction:column;padding:16px 12px}
.brand{display:flex;align-items:center;gap:9px;padding:2px 6px 16px;font-size:15px;letter-spacing:-.01em}
.logo{width:28px;height:28px;border-radius:6px;background:var(--primary);color:var(--on-primary);display:inline-flex;align-items:center;justify-content:center}
.ctx{display:flex;flex-direction:column;padding:10px;border-radius:6px;background:rgba(255,255,255,.06);margin-bottom:14px}
.ctx small{color:var(--sidebar-ink2);font-size:11.5px;letter-spacing:.02em}.ctx b{font-weight:600}
.sb nav{display:flex;flex-direction:column;gap:2px}
.nv{display:flex;align-items:center;gap:10px;padding:0 10px;height:36px;border-radius:6px;color:var(--sidebar-ink2)}
.nv b{font-weight:500;flex:1;color:var(--sidebar-ink)}.nv em{font-style:normal;font-size:12px;color:var(--sidebar-ink2)}
.nv.on{background:var(--sidebar-sel);color:var(--sidebar-sel-ink);box-shadow:inset 3px 0 0 var(--primary)}.nv.on b,.nv.on em{color:var(--sidebar-sel-ink);font-weight:600}
.me{margin-top:auto;display:flex;align-items:center;gap:10px;padding:12px 8px 2px;border-top:1px solid rgba(255,255,255,.12)}
.me div{display:flex;flex-direction:column;line-height:1.25}.me small{color:var(--sidebar-ink2);font-size:12px}
.av{width:30px;height:30px;border-radius:50%;background:var(--sidebar-sel);color:var(--sidebar-sel-ink);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:11.5px}
.work{display:flex;flex-direction:column;min-width:0;background:var(--ground)}
.top{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--hair);flex:none}
.crumb{display:flex;align-items:center;gap:6px;color:var(--ink2);font-size:13px}.crumb .i{opacity:.8}
.tr{display:flex;align-items:center;gap:10px}
.file{display:inline-flex;align-items:center;gap:8px;color:var(--ink2);font-size:12.5px}.file .i{color:var(--ok)}
.search{display:inline-flex;align-items:center;gap:8px;width:240px;height:32px;padding:0 10px;border:1px solid var(--edge);border-radius:6px;color:var(--ink2);font-size:13px}
.pad{padding:18px 24px 16px;display:flex;flex-direction:column;gap:12px;flex:1}
.titlerow{display:flex;align-items:flex-end;justify-content:space-between}
.frame h2{font:650 21px/1.2 var(--display);letter-spacing:-.015em;margin:0}
.sub{margin:3px 0 0;color:var(--ink2)}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.tile{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--hair);border-radius:6px;padding:10px 12px;background:var(--panel)}
.tile div{display:flex;flex-direction:column;line-height:1.2}.tile b{font:650 22px/1.1 var(--display)}.tile span{color:var(--ink2);font-size:12.5px;margin-top:3px}
.ti{width:34px;height:34px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:var(--well);color:var(--walnut-ink)}
.t-err .ti{background:var(--err-tint);color:var(--danger)}.t-err b{color:var(--danger)}
.t-warn .ti{background:var(--warn-tint);color:var(--warn)}
.banner{display:flex;align-items:center;gap:10px;border-radius:6px;padding:9px 12px;font-size:13px}
.banner b{font-weight:650}
.b-err{background:var(--err-tint);color:var(--ink);box-shadow:inset 3px 0 0 var(--danger)}.b-err>.g,.b-err b{color:var(--danger)}
.b-err>span{color:var(--ink)}.b-err .sep{color:var(--ink2)}.bsum{margin-left:auto;color:var(--ink2)!important}
.b-note{background:var(--walnut-tint);color:var(--walnut-ink);box-shadow:inset 3px 0 0 var(--walnut-ink)}
.b-ok{background:var(--ok-tint);color:var(--ink);box-shadow:inset 3px 0 0 var(--ok)}.b-ok .i{color:var(--ok)}
.tight{padding:7px 10px}
/* ruled tables */
.grid{width:100%;border-collapse:collapse;font-size:13px}
.grid th{height:34px;text-align:left;font-weight:600;font-size:12px;letter-spacing:.02em;color:var(--ink2);background:var(--well);border-bottom:1px solid var(--hair);padding:0 10px}
.grid.band th{background:var(--band);color:var(--on-band);border:0}
.grid.band thead th:first-child{border-radius:6px 0 0 0}.grid.band thead th:last-child{border-radius:0 6px 0 0}
.grid td{height:36px;padding:6px 10px;border-bottom:1px solid var(--hair);vertical-align:middle}
.grid .n{text-align:right}.grid .muted{color:var(--ink2)}
.c-ic{width:34px;padding-right:0!important}.c-act{width:132px}
.r-err td{background:var(--err-tint)}.r-err .c-ic{color:var(--danger)}
.r-warn .c-ic{color:var(--warn)}.r-ok .c-ic{color:var(--ok)}.r-ok td{color:var(--ink)}
.r-group td{height:30px;background:var(--panel);color:var(--warn);font-size:12.5px;padding-top:10px}
.r-group .g{vertical-align:-3px;margin-right:6px}.r-group b{color:var(--ink);margin-right:8px}.r-group span{color:var(--ink2)}
.acts{display:inline-flex;gap:6px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 14px;border-radius:6px;border:1px solid var(--edge);background:var(--panel);color:var(--ink);font-weight:600;font-size:13.5px;white-space:nowrap}
.btn.pri{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
.btn.sm{height:28px;padding:0 10px;font-size:12.5px}.btn.xs{height:22px;padding:0 8px;font-size:12px;margin-left:4px}
.btn.dis{background:var(--well);border-color:var(--well);color:var(--ink2);cursor:not-allowed}
.seg{display:inline-flex;border:1px solid var(--edge);border-radius:6px;overflow:hidden;font-size:12px}
.seg span{padding:4px 9px;color:var(--ink2);border-left:1px solid var(--hair);white-space:nowrap}.seg span:first-child{border-left:0}
.seg .on{background:var(--walnut-tint);color:var(--walnut-ink);font-weight:650}.seg small{font-weight:500;opacity:.9}
.foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 24px;border-top:1px solid var(--hair);background:var(--panel)}
.why{display:flex;align-items:center;gap:8px;color:var(--ink)}.why>.g{color:var(--danger)}.why b{color:var(--danger)}.why small{color:var(--ink2);margin-left:10px;font-size:12.5px}
/* status + type tags: filled, shape first */
.st{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 8px 0 6px;border-radius:4px;font-size:12px;font-weight:650;white-space:nowrap}
.st-draft{background:var(--well);color:var(--ink2)}.st-review{background:var(--primary-tint);color:var(--primary)}
.st-sub{background:var(--walnut-tint);color:var(--walnut-ink)}.st-app{background:var(--ok-tint);color:var(--ok)}.st-fail{background:var(--err-tint);color:var(--danger)}
.tt{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:4px;font-size:12px;font-weight:600}
.tt-read{background:var(--tag-read);color:var(--tag-read-ink)}.tt-write{background:var(--tag-write);color:var(--tag-write-ink)}.tt-flex{background:var(--tag-flex);color:var(--tag-flex-ink)}
.bk{display:inline-flex;align-items:center;gap:6px;color:var(--danger)}.bk b{font-weight:700}
/* M2 */
.board-top{display:grid;grid-template-columns:1.25fr 1fr;gap:12px}
.card{border:1px solid var(--hair);border-radius:6px;background:var(--panel);padding:12px 14px}
.ch{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.ch b{font-weight:650}.ch>span{color:var(--ink2);font-size:12.5px}
.bar{display:flex;height:10px;border-radius:3px;overflow:hidden;gap:2px;background:var(--panel)}
.sg-st-draft{background:var(--hair)}.sg-st-review{background:var(--primary)}.sg-st-sub{background:var(--walnut-ink)}.sg-st-app{background:var(--ok)}.sg-st-fail{background:var(--danger)}
.rts{display:grid;grid-template-columns:repeat(5,1fr);gap:0;margin-top:12px;border:1px solid var(--hair);border-radius:6px}
.rt{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-left:1px solid var(--hair)}.rt:first-child{border-left:0}
.rt b{font:650 20px/1 var(--display)}
.star{background:var(--primary-tint);color:var(--primary)!important;font-weight:650;border-radius:4px;padding:2px 7px}
.nsv{display:flex;align-items:flex-end;gap:22px}.nsv small{display:block;color:var(--ink2);font-size:12px}
.big{font:680 40px/1 var(--display);letter-spacing:-.02em}.big span{font-size:16px;font-weight:600;color:var(--ink2);letter-spacing:0}
.nsn{display:flex;gap:18px;padding-bottom:4px}.nsn span{display:flex;flex-direction:column;border-left:2px solid var(--hair);padding-left:10px}.nsn b{font-size:15px}
.cap{margin:10px 0 0;color:var(--ink2);font-size:12.5px}
.filters{display:flex;align-items:center;justify-content:space-between}
.chips{display:flex;gap:6px}.chip{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 10px;border-radius:6px;background:var(--well);color:var(--ink);font-size:12.5px;font-weight:550}
.chip em{font-style:normal;color:var(--ink2);font-size:12px}.chip.on{background:var(--band);color:var(--on-band)}.chip.on em{color:var(--on-band);opacity:.85}
.sort{display:inline-flex;align-items:center;gap:6px;color:var(--ink2);font-size:12.5px}
/* M3 */
.lhead{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 24px;border-bottom:1px solid var(--hair);flex:none}
.meta{display:flex;align-items:center;gap:10px;margin:7px 0 0;color:var(--ink2);font-size:12.5px}.meta>span{display:inline-flex;align-items:center;gap:5px}
.ver{font-weight:650;color:var(--ink)!important;border-left:1px solid var(--hair);padding-left:10px}
.steps{display:flex;list-style:none;margin:0;padding:0;gap:0}
.steps li{display:flex;flex-direction:column;align-items:center;gap:4px;width:84px;position:relative;font-size:12px;color:var(--ink2)}
.steps li:not(:last-child)::after{content:"";position:absolute;top:11px;left:calc(50% + 15px);width:calc(100% - 30px);border-top:2px dashed var(--hair)}
.steps li.done:not(:last-child)::after{border-top-style:solid;border-color:var(--walnut-ink)}
.steps .dot{width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;border:1.5px solid var(--edge);background:var(--panel);color:var(--ink2)}
.steps .done .dot{background:var(--walnut-ink);border-color:var(--walnut-ink);color:var(--panel)}
.steps .cur .dot{background:var(--primary);border-color:var(--primary);color:var(--on-primary);box-shadow:0 0 0 3px var(--primary-tint)}
.steps b{font-weight:600;color:var(--ink)}.steps .todo b{font-weight:500;color:var(--ink2)}.steps small{color:var(--primary);font-weight:650;font-size:11px;margin-top:-3px}
.ws{display:grid;grid-template-columns:176px 1fr 340px;flex:1;min-height:0}
.outline{border-right:1px solid var(--hair);padding:14px 10px}
.outline h4,.ev h5{margin:0 0 8px;padding:0 6px;font-size:11.5px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2)}
.outline ul{list-style:none;margin:0;padding:0}
.outline li{display:flex;align-items:center;gap:6px;height:32px;padding:0 8px;border-radius:6px;color:var(--ink)}
.outline li span:first-child{flex:1}.outline li em{font-style:normal;color:var(--ink2);font-size:12px}
.outline li.sub{padding-left:22px}.outline li.sel{background:var(--primary-tint);color:var(--ink);font-weight:600;box-shadow:inset 3px 0 0 var(--primary)}
.pav{width:20px;height:20px;border-radius:50%;background:var(--tag-flex);color:var(--tag-flex-ink);font-size:9.5px;font-weight:750;display:inline-flex;align-items:center;justify-content:center;flex:none;box-shadow:0 0 0 2px var(--panel)}
.presence{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink2);background:var(--well);height:30px;padding:0 10px 0 6px;border-radius:6px}
.ed{display:flex;flex-direction:column;min-width:0;background:var(--panel)}
.tb{display:flex;gap:4px;padding:8px 18px;border-bottom:1px solid var(--hair);color:var(--ink2)}.tb .i{padding:5px;width:27px;height:27px;border-radius:5px}
.doc{padding:16px 26px 20px;max-width:68ch;font-size:14.5px;line-height:1.6}
.sl{margin:0 0 4px;font-size:11.5px;font-weight:650;letter-spacing:.05em;text-transform:uppercase;color:var(--walnut-ink)}
.doc h3{font:650 18px/1.3 var(--display);margin:0 0 10px;letter-spacing:-.01em}
.line{margin:0 0 8px;display:flex;gap:10px;align-items:baseline}
.cue{flex:none;font-size:11px;font-weight:750;letter-spacing:.06em;text-transform:uppercase;background:var(--walnut-tint);color:var(--walnut-ink);border-radius:4px;padding:1px 6px;min-width:36px;text-align:center}
.samp{margin:0 0 18px 46px;color:var(--ink2);font-size:13.5px}
.slot{display:flex;gap:12px;align-items:flex-start;background:var(--err-tint);border-radius:6px;padding:12px;margin:6px 0 16px;box-shadow:inset 3px 0 0 var(--danger);font-size:13.5px;line-height:1.5}
.slot>.i{color:var(--danger);margin-top:2px}.slot>div{flex:1}
.slotm{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 0}
.tagw{background:var(--panel);color:var(--ink2);border-radius:4px;padding:1px 7px;font-size:12px}
.pres-line{display:flex;align-items:center;gap:10px}
.caret{display:inline-flex;align-items:center;gap:6px;text-transform:none;letter-spacing:0;font-weight:600;font-size:12px;color:var(--tag-flex-ink);background:var(--tag-flex);border-radius:4px;padding:2px 8px 2px 3px}
.ev{border-left:1px solid var(--hair);padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:var(--panel)}
.evh{display:flex;align-items:center;justify-content:space-between}.evh>b{font-weight:650}
.tabs{display:inline-flex;background:var(--well);border-radius:6px;padding:2px;font-size:12px}
.tabs span{padding:3px 9px;border-radius:4px;color:var(--ink2);font-weight:550}.tabs .on{background:var(--panel);color:var(--ink);box-shadow:0 0 0 1px var(--hair)}.tabs em{font-style:normal;margin-left:3px}
.issues{list-style:none;margin:0;padding:0;border:1px solid var(--hair);border-radius:6px}
.issues li{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-top:1px solid var(--hair)}.issues li:first-child{border-top:0}
.issues li>.g{margin-top:2px}.issues .blk>.g{color:var(--danger)}.issues .adv>.g{color:var(--ink2)}
.issues div{flex:1;display:flex;flex-direction:column;gap:1px;font-size:13px}.issues b{font-weight:550}.issues small{margin-top:2px}
.sev{font-size:11px;font-weight:750;letter-spacing:.05em;text-transform:uppercase}.blk .sev{color:var(--danger)}.adv .sev{color:var(--ink2)}
.go{color:var(--ink2);margin-top:2px}
.ev h5{margin:4px 0 0;padding:0}
.stds{list-style:none;margin:0;padding:0;border:1px solid var(--hair);border-radius:6px}
.stds li{padding:7px 10px;border-top:1px solid var(--hair);font-size:12.5px}.stds li:first-child{border-top:0}
.sr1{display:flex;align-items:center;gap:8px}.sr1 .g{color:var(--ok)}.sr1 span{color:var(--ink2)}
.sr2{display:flex;gap:14px;margin:3px 0 0 24px;color:var(--ink2)}.sr2 b{color:var(--ink);font-weight:600}
.stds .r-conf{background:var(--err-tint)}.r-conf .sr1 .g{color:var(--danger)}.r-conf .sr1 span{color:var(--ink)}
.off{margin:0;background:var(--well);border-radius:6px;padding:10px 12px;font-size:12.5px;line-height:1.5}
.off small{display:flex;align-items:center;gap:6px;color:var(--ink2);margin-bottom:4px;font-size:11.5px}
/* M4 */
.ap{display:grid;grid-template-columns:1fr 330px;gap:16px;padding:16px 24px 20px;flex:1}
.apm{display:flex;flex-direction:column;gap:12px}.aps{display:flex;flex-direction:column;gap:12px}
.b-note .i{color:var(--walnut-ink)}
.checks{list-style:none;margin:0;padding:0}
.checks li{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--hair)}.checks li:first-child{border-top:0;padding-top:0}
.checks li>.g{color:var(--ok);margin-top:2px}.checks div{display:flex;flex-direction:column}.checks b{font-weight:600}.checks small{color:var(--ink2);font-size:12.5px;margin-top:1px}
.req{background:var(--well);color:var(--ink2)!important;border-radius:4px;padding:1px 7px;font-weight:600}
.radios{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.radios span{display:flex;align-items:center;gap:9px;height:40px;padding:0 12px;border:1px solid var(--edge);border-radius:6px;color:var(--ink)}
.radios .on{border:2px solid var(--primary);background:var(--primary-tint);padding:0 11px}
.rd{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--edge);flex:none;background:var(--panel)}.on .rd{border:5px solid var(--primary)}
.decide{display:flex;align-items:center;gap:10px;justify-content:flex-end;padding-top:4px}.apm>.fine{margin:-4px 0 0;text-align:right;color:var(--ink2);font-size:12.5px}
.tl{list-style:none;margin:0;padding:0}
.tl li{display:flex;gap:12px;position:relative;padding-bottom:14px}
.tl li:not(:last-child)::before{content:"";position:absolute;left:8px;top:20px;bottom:0;border-left:2px solid var(--hair)}
.tl li.done:not(:last-child)::before{border-color:var(--ok)}
.tl .nd{width:18px;height:18px;flex:none;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--ok);margin-top:1px}
.tl .nd .g{width:18px;height:18px}
.tl .cur .nd{border:2px solid var(--primary);background:var(--panel);box-shadow:inset 0 0 0 3px var(--panel),inset 0 0 0 9px var(--primary)}
.tl .todo .nd{border:1.5px solid var(--edge);background:var(--panel)}
.tl li div{display:flex;flex-direction:column;gap:2px}.tl b{font-weight:600}.tl small{color:var(--ink2);font-size:12.5px}
.tl .cur{background:var(--primary-tint);margin:0 -8px 10px;padding:8px;border-radius:6px}
.tl .cur::before{display:none}.tl .cur .st{align-self:flex-start;margin-top:3px;background:var(--panel)}
.kv{display:flex;justify-content:space-between;align-items:center;height:32px;border-top:1px solid var(--hair);font-size:13px}.kv:first-of-type{border-top:0}.kv span{color:var(--ink2)}.kv b{font-weight:600}
"""

# ---------------------------------------------------------------- contrast (WCAG 2.x relative luminance)
def lum(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def failures():
    out = []
    for mode, pal in (("light", LIGHT), ("dark", DARK)):
        out += [f"{mode}: text {fg} on {bg} = {ratio(pal[fg], pal[bg]):.2f}:1 (needs 4.5)"
                for fg, bg in PAIRS if ratio(pal[fg], pal[bg]) < 4.5]
        out += [f"{mode}: UI {fg} on {bg} = {ratio(pal[fg], pal[bg]):.2f}:1 (needs 3)"
                for fg, bg in UI_PAIRS if ratio(pal[fg], pal[bg]) < 3]
    return out


def contrast_table(pal):
    rows = "".join(
        f"<tr><td><span class='aa' style='background:{pal[bg]};color:{pal[fg]}'>Aa</span>{fg} on {bg}</td>"
        f"<td class='num r'>{ratio(pal[fg], pal[bg]):.2f}:1</td><td>{'AA text' if ratio(pal[fg], pal[bg]) >= 4.5 else 'FAIL'}</td></tr>"
        for fg, bg in PAIRS)
    rows += "".join(
        f"<tr class='ui'><td><span class='aa' style='background:{pal[bg]};box-shadow:inset 0 0 0 2px {pal[fg]}'></span>{fg} edge on {bg}</td>"
        f"<td class='num r'>{ratio(pal[fg], pal[bg]):.2f}:1</td><td>{'AA UI part' if ratio(pal[fg], pal[bg]) >= 3 else 'FAIL'}</td></tr>"
        for fg, bg in UI_PAIRS)
    return f"<div class='tw'><table class='ct'><thead><tr><th>Pair</th><th class='r'>Ratio</th><th>Verdict</th></tr></thead><tbody>{rows}</tbody></table></div>"


def lowest(pal, pairs):
    fg, bg = min(pairs, key=lambda p: ratio(pal[p[0]], pal[p[1]]))
    return fg, bg, ratio(pal[fg], pal[bg])


SW_KEYS = ["ground", "panel", "well", "hair", "edge", "ink", "ink2", "primary", "on-primary", "primary-tint",
           "danger", "err-tint", "warn", "warn-tint", "ok", "ok-tint", "sidebar", "sidebar-ink", "sidebar-sel",
           "band", "walnut-ink", "walnut-tint", "tag-read", "tag-write", "tag-flex"]


def swatches(pal):
    return "".join(f"<div class='sw'><span style='background:{pal[k]}'></span><b>{k}</b><code>{pal[k]}</code></div>"
                   for k in SW_KEYS)


def css_vars(pal):
    return ";".join(f"--{k}:{v}" for k, v in pal.items())


# ---------------------------------------------------------------- reference images
def shrink_all():
    scratch = pathlib.Path(os.environ.get("D4_SCRATCH") or tempfile.mkdtemp(prefix="d4look_"))
    scratch.mkdir(parents=True, exist_ok=True)
    uris = {}
    for f, *_ in SHOTS:
        src, dst = REFS / f, scratch / f
        if shutil.which("sips"):
            subprocess.run(["sips", "-Z", "900", "-s", "format", "jpeg", "-s", "formatOptions", "80", str(src),
                            "--out", str(dst)], check=True, capture_output=True)
            data = dst.read_bytes()
        else:
            data = src.read_bytes()
        uris[f] = f"data:image/jpeg;base64,{base64.b64encode(data).decode()}"
    return uris


def shots_html(uris):
    return "".join(
        f"<figure class='shot'><img src='{uris[f]}' alt='{t} by {d}'><figcaption><p class='sid'><code>{f[:5]}</code>"
        f"<span class='int'>internal reference only</span></p><b>{t}</b><span class='by'>{d}</span>"
        f"<p class='why'><b>Why kept:</b> {why}</p><p class='why'><b>Feel-brief line:</b> {line}</p>"
        f"<a href='{u}'>{u}</a></figcaption></figure>"
        for f, t, d, u, why, line in SHOTS)


# ---------------------------------------------------------------- page chrome
PAGE_CSS = r"""
:root{--page-bg:#F1F0EE;--page-card:#FFFFFF;--page-ink:#231F1C;--page-ink2:#5E5650;--page-hair:#E2DCD6;--page-link:#B4410F;--page-chip:#F3F1EE;
--ui:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue','Segoe UI',Roboto,Arial,sans-serif;
--display:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue','Segoe UI',Roboto,Arial,sans-serif;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--page-bg:#141210;--page-card:#1E1A17;--page-ink:#F1ECE6;--page-ink2:#BDB3A8;--page-hair:#36302A;--page-link:#F08A5D;--page-chip:#2B2621}}
:root[data-theme="dark"]{--page-bg:#141210;--page-card:#1E1A17;--page-ink:#F1ECE6;--page-ink2:#BDB3A8;--page-hair:#36302A;--page-link:#F08A5D;--page-chip:#2B2621}
*{box-sizing:border-box}
body{margin:0;background:var(--page-bg);color:var(--page-ink);font:15px/1.55 var(--ui);-webkit-font-smoothing:antialiased}
.page{max-width:1280px;margin:0 auto;padding:28px 16px 64px}
code{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:.9em}
.num{font-variant-numeric:tabular-nums}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
.badges span{background:var(--page-card);border:1px solid var(--page-hair);border-radius:6px;padding:2px 9px;font-size:12.5px;color:var(--page-ink2)}
.badges .prop{background:#B4410F;border-color:#B4410F;color:#fff;font-weight:650}
h1{font:700 34px/1.1 var(--display);letter-spacing:-.025em;margin:0 0 8px;text-wrap:balance}
h1 em{font-style:normal;color:var(--page-ink2);font-weight:500}
.intent{font:500 20px/1.35 var(--display);margin:0 0 10px;letter-spacing:-.01em;max-width:60ch;text-wrap:balance}
.lede{color:var(--page-ink2);margin:0;max-width:78ch;text-wrap:pretty}
.glance{margin:20px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
.glance div{background:var(--page-card);border:1px solid var(--page-hair);border-radius:6px;padding:10px 12px}
.glance small{display:block;font-size:11.5px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--page-ink2)}
.glance b{font-weight:600;font-size:14px}
section.s{margin:44px 0 0}
section.s>h2{font:680 22px/1.2 var(--display);letter-spacing:-.015em;margin:0 0 4px}
.note{color:var(--page-ink2);margin:0 0 16px;max-width:86ch;text-wrap:pretty}
.mock{margin:0 0 28px}
.mcap{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin:0 0 10px}
.mcap b{font:650 16px var(--display)}.mcap code{color:var(--page-ink2)}.mcap span{color:var(--page-ink2);font-size:13.5px;flex-basis:100%}
.scroller{overflow-x:auto;padding:4px 4px 18px;margin:0 -4px;-webkit-overflow-scrolling:touch}
.scroller:focus-visible{outline:2px solid var(--page-link);outline-offset:2px}
.palettes{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.pal{border-radius:8px;padding:16px;border:1px solid var(--page-hair)}.pal h3{margin:0 0 12px;font:650 16px var(--display)}
.sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px}
.sw{font-size:12px;display:flex;flex-direction:column;gap:1px;min-width:0}.sw b{font-weight:600;overflow-wrap:anywhere}
.sw span{height:38px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(127,127,127,.3);margin-bottom:4px}.sw code{opacity:.85;font-size:11px}
.tw{overflow-x:auto;margin-top:14px}
.ct{border-collapse:collapse;width:100%;font-size:12.5px}.ct th{text-align:left;font-weight:650;padding:4px 6px;border-bottom:1px solid rgba(127,127,127,.35)}
.ct td{padding:3px 6px;border-top:1px solid rgba(127,127,127,.2)}.ct .r{text-align:right}.ct tr.ui td{font-style:italic}
.aa{display:inline-flex;width:30px;height:20px;border-radius:4px;align-items:center;justify-content:center;font-weight:700;font-size:11px;margin-right:8px;vertical-align:middle;font-style:normal}
.lowest{margin-top:10px;font-size:13px}
.ht{border-collapse:collapse;width:100%;background:var(--page-card);border:1px solid var(--page-hair);border-radius:6px;font-size:14px}
.ht th,.ht td{text-align:left;padding:8px 12px;border-top:1px solid var(--page-hair);vertical-align:top}.ht th{border-top:0;font-size:12.5px;color:var(--page-ink2)}
.pass{font-weight:650;white-space:nowrap}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.shot{margin:0;background:var(--page-card);border:1px solid var(--page-hair);border-radius:8px;overflow:hidden;display:flex;flex-direction:column}
.shot img{width:100%;display:block;aspect-ratio:4/3;object-fit:cover;border-bottom:1px solid var(--page-hair)}
.shot figcaption{padding:12px 14px;font-size:13px;display:flex;flex-direction:column;gap:3px}
.sid{display:flex;justify-content:space-between;align-items:center;margin:0 0 2px}
.int{font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--page-ink2)}
.by{color:var(--page-ink2)}.why{margin:2px 0 0;color:var(--page-ink)}.why b{font-weight:600}
.shot a{color:var(--page-link);word-break:break-all;font-size:12px;margin-top:4px}
footer.pf{margin-top:44px;padding-top:16px;border-top:1px solid var(--page-hair);color:var(--page-ink2);font-size:13.5px}
"""

HOUSE = [
    ("Cream canvas", "No. The work canvas is white (#FFFFFF); warmth comes from the walnut sidebar and terracotta, never the ground."),
    ("Serif headings", "No. Headings use the system grotesk (SF Pro Display / Helvetica Neue / Segoe UI)."),
    ("Outlined pills", "No. Status and type tags are filled 4 px tags with a shape glyph; chips are filled."),
    ("Sage accents", "No. Greens appear only as the OK/approved status colour (#1D7442), saturated, never a muted grey-green accent."),
]


def page(uris):
    lt, dk = css_vars(LIGHT), css_vars(DARK)
    mocks = "".join(
        f"<div class='mock'><div class='mcap'><b>{t}</b><code>{flow}</code><span>{d}</span></div>"
        f"<div class='scroller' tabindex='0' role='region' aria-label='{t} mockup, scrolls sideways'>"
        f"<div style='{lt}'>{html}</div></div></div>" for t, flow, d, html in MOCKUPS)
    t3, f3, _, h3 = MOCKUPS[DARK_MOCKUP]
    dark = (f"<div class='mock'><div class='mcap'><b>{t3} · dark</b><code>{f3}</code><span>The same markup on the dark twin: "
            f"warm charcoal ground, a darker walnut sidebar, terracotta lightened to {DARK['primary']} with near-black text on it.</span></div>"
            f"<div class='scroller' tabindex='0' role='region' aria-label='{t3} dark mockup, scrolls sideways'><div style='{dk}'>{h3}</div></div></div>")
    lows = {m: (lowest(p, PAIRS), lowest(p, UI_PAIRS)) for m, p in (("light", LIGHT), ("dark", DARK))}

    def low_line(m):
        (a, b, r), (c, d, s) = lows[m]
        return f"<p class='lowest'>Lowest text pair: <b>{a} on {b} {r:.2f}:1</b> · lowest UI edge: <b>{c} on {d} {s:.2f}:1</b></p>"

    house = "".join(f"<tr><td>{k}</td><td>{v}</td><td class='pass'>✓ pass</td></tr>" for k, v in HOUSE)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>D4 Warm Workroom look sheet</title><style>{PAGE_CSS}{CSS}</style></head>
<body><main class="page">
<header>
<div class="badges"><span>UX-2 · look sheet</span><span class="prop">Status: proposal</span><span>{DATE}</span><span>Newsela Lesson Studio</span></div>
<h1>{DIRECTION} · {NAME} <em>· light first, dark twin</em></h1>
<p class="intent">{INTENT}</p>
<p class="lede">This is a static look; linked-screen prototypes come only for the directions you shortlist. The four screens and every
word on them are the same as on the D1–D3 sheets (from <code>docs/ux/02-concepts/LOOK_SHEET_COPY.md</code>), so only the look changes.
People's names and the board's numbers are synthetic. Nothing here is clickable.</p>
<div class="glance">
<div><small>Softness</small><b>Firm: 6 px radius, ruled tables, no shadow</b></div>
<div><small>Density</small><b>Dense: 36 px rows, compact stat tiles</b></div>
<div><small>Shape</small><b>Tables, walnut-banded headers, vertical timeline, dark sidebar</b></div>
<div><small>Temperature</small><b>Warm: white canvas, walnut sidebar, terracotta</b></div>
<div><small>Type</small><b>System grotesk with tabular numbers</b></div>
</div></header>
<section class="s"><h2>Four screens in light mode (the primary theme)</h2>
<p class="note">Desktop frames at 1200 px. On a narrow screen each frame scrolls sideways inside its own box; the page never does.</p>
{mocks}</section>
<section class="s"><h2>M3 again, dark</h2>{dark}</section>
<section class="s"><h2>Palette (proposal; UX-3 makes it exact)</h2>
<p class="note">Seeds from <code>DESIGN-DIRECTIONS.md</code> (ground, panel, well, ink, ink2, primary, sidebar); the status, tag and
sidebar-text tokens are added at the same temperature. Contrast is computed in Python from these hex values with the WCAG 2
formula; the build exits 1 and writes nothing if any text pair is under 4.5:1 or any UI edge under 3:1. Table rules
(<code>hair</code>) are decorative; every control edge uses <code>edge</code>, which is checked. {CHANGES.format(band=f"{ratio(DARK['band'], DARK['panel']):.2f}")}</p>
<div class="palettes">
<div class="pal" style="background:{LIGHT['panel']};color:{LIGHT['ink']}"><h3>Light</h3><div class="sws">{swatches(LIGHT)}</div>{low_line('light')}{contrast_table(LIGHT)}</div>
<div class="pal" style="background:{DARK['ground']};color:{DARK['ink']}"><h3>Dark</h3><div class="sws">{swatches(DARK)}</div>{low_line('dark')}{contrast_table(DARK)}</div>
</div></section>
<section class="s"><h2>House-texture check</h2>
<div class="tw"><table class="ht"><thead><tr><th>Tell</th><th>On this sheet</th><th>Result</th></tr></thead><tbody>{house}</tbody></table></div></section>
<section class="s"><h2>The six references behind D4</h2>
<p class="note">Other designers' published Dribbble work, credited here and kept as internal reference only; nothing is copied into
the product. Downscaled to at most 900 px wide and embedded so the page opens offline.</p>
<div class="shots">{shots_html(uris)}</div></section>
<footer class="pf">Local file, not published. Rebuild: <code>python3 docs/artifacts/_build/d4-look/build_d4_look.py</code></footer>
</main></body></html>"""


if __name__ == "__main__":
    bad = failures()
    if bad:
        print("CONTRAST FAIL\n" + "\n".join(bad))
        sys.exit(1)
    OUT.write_text(page(shrink_all()))
    print(OUT, f"{OUT.stat().st_size / 1e6:.2f} MB")
    for mode, pal in (("light", LIGHT), ("dark", DARK)):
        a, b, r = lowest(pal, PAIRS)
        c, d, s = lowest(pal, UI_PAIRS)
        print(f"{mode}: lowest text pair {a} on {b} = {r:.2f}:1 · lowest UI edge {c} on {d} = {s:.2f}:1")
