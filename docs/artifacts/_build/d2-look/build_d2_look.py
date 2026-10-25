"""Build the D2 · Night Desk look sheet (UX-2: a static look before any prototype).

Copied from the ux-pipeline starter (templates/look_sheet_generator.py) on 2026-10-25 and filled for D2.
Run:      python3 docs/artifacts/_build/d2-look/build_d2_look.py
Writes:   docs/artifacts/2026-10-25-d2-night-desk-look-sheet.html (static, offline, images embedded)

D2 is dark-first: the four desktop mockups are drawn on the dark palette (its primary theme) and M3 is repeated
in the light twin. Copy comes word for word from docs/ux/02-concepts/LOOK_SHEET_COPY.md; construction follows the
D2 component-anatomy table in docs/design/DESIGN-DIRECTIONS.md. Palette values are a proposal; UX-3 makes them exact.
The build exits 1 if any text pair is under 4.5:1 or any UI part is under 3:1 (WCAG 2.x relative luminance).
Reference images are downscaled with macOS `sips` (≤ 900 px wide, JPEG quality 80) into a scratch folder first.
"""
import base64
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
DOCS = HERE.parents[2]  # docs/
REFS = DOCS / "design" / "references"
OUT = DOCS / "artifacts" / "2026-10-25-d2-night-desk-look-sheet.html"
SCRATCH = pathlib.Path.home() / ".claude" / "jobs" / "3bd1a004" / "tmp" / "d2"

DIRECTION = "D2"
NAME = "Night Desk"
INTENT = "A focused workbench for experts who live in it all day."
DATE = "2026-10-25"

# Credits from design/references/_index.json (direction "d2"); "why kept" and feel line from ux/02-concepts/REFERENCES.md.
SHOTS = [
    ("d2-01-personal-task-workflow-organization-tabl.jpg", "Personal Task & Workflow Organization Tablet Dashboard Design",
     "Airzon Agency", "https://dribbble.com/shots/27637209-Personal-Task-Workflow-Organization-Tablet-Dashboard-Design",
     "Grouped issue rows with status glyphs and mono IDs", "dense where scanning; calm"),
    ("d2-02-guildhall-review-what-your-ai-agent-chan.jpg", "Guildhall - Review What Your AI Agent Changed", "Kretya",
     "https://dribbble.com/shots/27790184-Guildhall-Review-What-Your-AI-Agent-Changed",
     "'Review what your AI agent changed': tabs, changed files with counts, diff gutter", "evidence visible; review a version"),
    ("d2-03-ai-writing-assistant-dark.jpg", "AI Writing Assistant - Dark", "Dmitry Sergushkin",
     "https://dribbble.com/shots/27449324-AI-Writing-Assistant-Dark", "Dark AI rewrite card",
     "AI help is one quiet labelled tool"),
    ("d2-04-write-for-mac-dark-theme.jpg", "Write for Mac - Dark Theme", "Tanmay",
     "https://dribbble.com/shots/1674503-Write-for-Mac-Dark-Theme", "Long-form reading in a dark column", "editorial first"),
    ("d2-05-zusgpt-ai-writing-report-dashboard.jpg", "ZusGPT - AI Writing Report Dashboard", "Wavespace - UI/UX Design Agency",
     "https://dribbble.com/shots/27394164-ZusGPT-AI-Writing-Report-Dashboard", "Dense report table with status pills",
     "dense where scanning"),
    ("d2-06-dark-mode-kanban-dashboard-task-issue-ma.jpg", "Dark Mode Kanban Dashboard – Task & Issue Management Board",
     "Milos Vasiljevic", "https://dribbble.com/shots/25606179-Dark-Mode-Kanban-Dashboard-Task-Issue-Management-Board",
     "Dark board columns with soft tags", "calm"),
]

# ---------------------------------------------------------------------------------------------------------------
# Palettes. Base tokens (ground, panel, well, ink, ink2, primary) are the DESIGN-DIRECTIONS.md values unchanged.
# The rest are added here for the construction: rail, side, selected, hair (decorative divider, not checked),
# edge (control borders, checked at 3:1), status hues for glyphs, and diff tints.
# Changed by the contrast gate, same hue: dark edge #5E5F68 -> #6E6F78 (2.57:1 on well -> 3.26:1);
# light add tint #E4F4EA -> #EEF8F1 (green text on it 4.36:1 -> 4.57:1).
# ---------------------------------------------------------------------------------------------------------------
DARK = {
    "ground": "#0E0F11", "rail": "#0A0B0D", "side": "#121315", "panel": "#17181B", "well": "#1F2024",
    "selected": "#26272C", "hair": "#25262A", "edge": "#6E6F78",
    "ink": "#EDEDEF", "ink2": "#A1A1AA",
    "primary": "#3DD68C", "on-primary": "#03140B", "ok": "#3DD68C",
    "danger": "#F87171", "danger-tint": "#2A1517", "add": "#11281C", "del": "#2C1518",
    "amber": "#E5A93D", "blue": "#7FA6F5",
}
LIGHT = {
    "ground": "#FAFAFA", "rail": "#F0F0F2", "side": "#F5F5F7", "panel": "#FFFFFF", "well": "#F2F2F4",
    "selected": "#E8E8EC", "hair": "#E4E4E7", "edge": "#8A8A93",
    "ink": "#111113", "ink2": "#55555E",
    "primary": "#12804F", "on-primary": "#FFFFFF", "ok": "#12804F",
    "danger": "#C42B2B", "danger-tint": "#FCECEC", "add": "#EEF8F1", "del": "#FBE9E9",
    "amber": "#A6680A", "blue": "#2F5BD3",
}
# Every pair where text sits in the mockups: must reach 4.5:1.
TEXT_PAIRS = [("ink", "ground"), ("ink", "side"), ("ink", "panel"), ("ink", "well"), ("ink", "selected"),
              ("ink", "add"), ("ink", "del"), ("ink", "danger-tint"),
              ("ink2", "ground"), ("ink2", "side"), ("ink2", "panel"), ("ink2", "well"), ("ink2", "selected"),
              ("ok", "panel"), ("ok", "add"), ("danger", "panel"), ("danger", "del"), ("danger", "danger-tint"),
              ("on-primary", "primary")]
# Non-text parts that carry meaning (control borders, status glyphs, icons, the primary button): 3:1.
UI_PAIRS = [("edge", "panel"), ("edge", "well"), ("primary", "panel"), ("danger", "panel"), ("amber", "panel"),
            ("blue", "panel"), ("ink2", "rail"), ("ink2", "side")]


def lum(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def contrast_rows(pal):
    out = []
    for fg, bg in TEXT_PAIRS:
        r = ratio(pal[fg], pal[bg])
        out.append(f"<tr><td>{fg} on {bg}</td><td class='num'>{r:.2f}:1</td><td>{'AA text' if r >= 4.5 else 'FAIL'}</td></tr>")
    for fg, bg in UI_PAIRS:
        r = ratio(pal[fg], pal[bg])
        out.append(f"<tr class='ui'><td>{fg} part on {bg}</td><td class='num'>{r:.2f}:1</td><td>{'AA UI part' if r >= 3 else 'FAIL'}</td></tr>")
    return "".join(out)


def swatches(pal):
    return "".join(f"<div class='sw'><span style='background:{v}'></span><b>{k}</b><code>{v}</code></div>" for k, v in pal.items())


def css_vars(pal):
    return ";".join(f"--{k}:{v}" for k, v in pal.items())


def img(name):
    """Downscale to ≤ 900 px wide, JPEG q80, via sips; fall back to the original bytes if sips is missing."""
    src = REFS / name
    SCRATCH.mkdir(parents=True, exist_ok=True)
    dst = SCRATCH / f"small-{name}"
    try:
        width = int(subprocess.run(["sips", "-g", "pixelWidth", str(src)], capture_output=True, text=True,
                                   check=True).stdout.split()[-1])
        args = ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "80"]
        if width > 900:
            args += ["--resampleWidth", "900"]
        subprocess.run(args + [str(src), "--out", str(dst)], capture_output=True, check=True)
        data = dst.read_bytes()
    except (OSError, subprocess.CalledProcessError, ValueError):
        data = src.read_bytes()
    return f"data:image/jpeg;base64,{base64.b64encode(data).decode()}"


# ---------------------------------------------------------------------------------------------------------------
# Icons and status glyphs (inline SVG, currentColor). Status is always glyph shape + a text label, never colour alone.
# ---------------------------------------------------------------------------------------------------------------
def ico(path, size=16, sw="1.6"):
    return (f"<svg class='i' width='{size}' height='{size}' viewBox='0 0 24 24' fill='none' stroke='currentColor' "
            f"stroke-width='{sw}' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>{path}</svg>")


I_INBOX = ico("<path d='M3.5 13.5l2.4-7.2A1.5 1.5 0 0 1 7.3 5.3h9.4a1.5 1.5 0 0 1 1.4 1l2.4 7.2V18a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18z'/><path d='M3.5 13.5h4.5l1.5 2h5l1.5-2h4.5'/>", 18)
I_BOARD = ico("<rect x='3.5' y='4' width='5' height='16' rx='1.2'/><rect x='10.5' y='4' width='5' height='11' rx='1.2'/><rect x='17.5' y='4' width='3' height='7' rx='1'/>", 18)
I_DOC = ico("<path d='M7 3.5h7l4 4v13H7z'/><path d='M14 3.5v4h4M10 12h5M10 15.5h5'/>", 18)
I_SHEET = ico("<rect x='4' y='4' width='16' height='16' rx='1.5'/><path d='M4 9.5h16M4 14.5h16M9.5 4v16'/>", 18)
I_APPROVE = ico("<circle cx='12' cy='12' r='8.5'/><path d='M8.2 12.3l2.6 2.6 5-5.3'/>", 18)
I_SEARCH = ico("<circle cx='11' cy='11' r='6.5'/><path d='M20 20l-4.2-4.2'/>", 18)
I_GEAR = ico("<circle cx='12' cy='12' r='3'/><path d='M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6'/>", 18)
I_BACK = ico("<path d='M14.5 18l-6-6 6-6'/>", 16)
I_CHEV = ico("<path d='M9 6l6 6-6 6'/>", 12, "2")
I_DOWN = ico("<path d='M6 9l6 6 6-6'/>", 12, "2")
I_FILTER = ico("<path d='M4 6h16M7 12h10M10 18h4'/>", 14)
I_SORT = ico("<path d='M12 5v14M7 14l5 5 5-5'/>", 12, "2")
I_LOCK = ico("<rect x='5' y='11' width='14' height='9' rx='1.5'/><path d='M8 11V8a4 4 0 0 1 8 0v3'/>", 14)
I_LINK = ico("<path d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'/><path d='M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'/>", 14)
I_QUOTE = ico("<path d='M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6'/>", 14)
I_CLOCK = ico("<circle cx='12' cy='12' r='8.5'/><path d='M12 7.5V12l3 2'/>", 13)
I_EYE = ico("<path d='M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'/><circle cx='12' cy='12' r='2.6'/>", 14)
I_RETRY = ico("<path d='M4.5 12a7.5 7.5 0 1 0 2.2-5.3'/><path d='M4.5 4.5v3.5H8'/>", 13)
I_PEN = ico("<path d='M4 20l4-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5 16z'/>", 13)


def g(kind, size=14):
    """Status glyph circles (after the d2-01 issue-tracker construction)."""
    s = f"width='{size}' height='{size}' viewBox='0 0 16 16' aria-hidden='true' class='g'"
    shapes = {
        "draft": "<circle cx='8' cy='8' r='6' fill='none' stroke='var(--ink2)' stroke-width='1.5' stroke-dasharray='2.2 2'/>",
        "review": "<circle cx='8' cy='8' r='6' fill='none' stroke='var(--amber)' stroke-width='1.5'/><path d='M8 3.5a4.5 4.5 0 0 1 0 9z' fill='var(--amber)'/>",
        "submitted": "<circle cx='8' cy='8' r='6' fill='none' stroke='var(--blue)' stroke-width='1.5'/><path d='M8 3.5a4.5 4.5 0 1 1-4.5 4.5H8z' fill='var(--blue)'/>",
        "approved": "<circle cx='8' cy='8' r='7' fill='var(--ok)'/><path d='M5 8.2l2 2 4-4.3' fill='none' stroke='var(--panel)' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/>",
        "exported": "<circle cx='8' cy='8' r='6' fill='none' stroke='var(--ink2)' stroke-width='1.5'/><path d='M6 10l4-4M7 6h3v3' fill='none' stroke='var(--ink2)' stroke-width='1.4' stroke-linecap='round'/>",
        "failed": "<circle cx='8' cy='8' r='7' fill='var(--danger)'/><path d='M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8' stroke='var(--panel)' stroke-width='1.8' stroke-linecap='round'/>",
        "error": "<circle cx='8' cy='8' r='7' fill='var(--danger)'/><path d='M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8' stroke='var(--panel)' stroke-width='1.8' stroke-linecap='round'/>",
        "blocking": "<path d='M5.1 1.5h5.8l3.6 3.6v5.8l-3.6 3.6H5.1l-3.6-3.6V5.1z' fill='var(--danger)'/><path d='M8 4.6v4.2' stroke='var(--panel)' stroke-width='1.9' stroke-linecap='round'/><circle cx='8' cy='11.3' r='1.1' fill='var(--panel)'/>",
        "warning": "<path d='M8 1.8l6.6 11.6H1.4z' fill='none' stroke='var(--amber)' stroke-width='1.5' stroke-linejoin='round'/><path d='M8 6.4v3.2' stroke='var(--amber)' stroke-width='1.6' stroke-linecap='round'/><circle cx='8' cy='11.4' r='.9' fill='var(--amber)'/>",
        "advisory": "<circle cx='8' cy='8' r='6' fill='none' stroke='var(--amber)' stroke-width='1.5'/><path d='M8 7.4v3.6' stroke='var(--amber)' stroke-width='1.6' stroke-linecap='round'/><circle cx='8' cy='5.2' r='.9' fill='var(--amber)'/>",
        "ok": "<circle cx='8' cy='8' r='7' fill='var(--ok)'/><path d='M5 8.2l2 2 4-4.3' fill='none' stroke='var(--panel)' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/>",
        "presence": "<circle cx='8' cy='8' r='4' fill='var(--ok)'/>",
    }
    return f"<svg {s}>{shapes[kind]}</svg>"


def st(kind, label):
    return f"<span class='st'>{g(kind)}<span>{label}</span></span>"


def m(text):
    return f"<code class='m'>{text}</code>"


RAIL_ICONS = [("inbox", I_INBOX), ("board", I_BOARD), ("sheet", I_SHEET), ("doc", I_DOC), ("approve", I_APPROVE)]


def rail(active):
    items = "".join(f"<span class='ri{' on' if k == active else ''}'>{v}</span>" for k, v in RAIL_ICONS)
    return (f"<nav class='rail' aria-label='App'><span class='logo' aria-hidden='true'>LS</span>{items}"
            f"<span class='ri'>{I_SEARCH}</span><span class='grow'></span><span class='ri'>{I_GEAR}</span></nav>")


def side(active):
    def item(key, glyph, label, count, extra=""):
        return (f"<div class='si{' on' if key == active else ''}'>{glyph}<span class='lbl'>{label}</span>"
                f"<span class='ct num'>{count}</span>{extra}</div>")
    return f"""<aside class='side'>
<div class='ws'><span class='wsm'>G6</span><div><b>Grade 6 · Unit 4</b><small>The Lightning Thief</small></div>{I_DOWN}</div>
<p class='sh'>Unit 4</p>
{item('outline', I_SHEET, 'Outline v1', '5', "<span class='ctd' title='errors to confirm'></span>")}
{item('board', I_BOARD, 'Unit board', '47')}
<p class='sh'>Lessons by state</p>
{item('draft', g('draft'), 'Draft', '34')}
{item('review', g('review'), 'In review', '6')}
{item('submitted', g('submitted'), 'Submitted', '2')}
{item('approved', g('approved'), 'Approved', '3')}
{item('failed', g('failed'), 'Failed', '2')}
</aside>"""


# ---------------------------------------------------------------------------------------------------------------
# M1 · SCR-4 Validation report (FLOW-3)
# ---------------------------------------------------------------------------------------------------------------
def diff(minus=None, plus=None, note=""):
    out = ""
    if minus:
        out += f"<div class='dl del'><i>−</i><code>{minus}</code></div>"
    if plus:
        out += f"<div class='dl add'><i>+</i><code>{plus}</code></div>"
    if note:
        out += f"<div class='dnote'>{note}</div>"
    return f"<div class='diff'>{out}</div>"


ACT = "<span class='acts'><span class='btn'>Confirm</span><span class='btn ghost'>Edit</span></span>"


def seg(options, chosen):
    return "<span class='seg'>" + "".join(
        f"<span class='{'on' if o == chosen else ''}'>{o}</span>" for o in options) + "</span>"


M1 = f"""<div class='frame' role='img' aria-label='M1 Validation report mockup'>{rail('sheet')}{side('outline')}
<section class='main'>
 <header class='top'><div class='crumbs'><span>Grade 6 · Unit 4 · <i>The Lightning Thief</i></span>{I_CHEV}<b>Outline v1</b></div>
  <div class='file'>{I_SHEET}{m('g6-u4-outline.xlsx')}<span class='dim'>· uploaded by A. Chen</span></div></header>
 <div class='titlebar'><h3>Validation report</h3>
  <div class='stats'><span><b class='num'>47</b> teaching days</span><span class='sep'></span>
   <span class='bad'>{g('error')}<b class='num'>5</b> errors to confirm</span><span class='sep'></span>
   <span>{g('warning')}<b class='num'>7</b> ELD labels flagged</span><span class='sep'></span>
   <span>{g('warning')}<b class='num'>2</b> bad filenames</span></div></div>
 <div class='list'>
  <div class='gh'>{g('error')}<b>Errors</b><span class='ct num'>5</span><span class='dim'>Confirm or edit each before generating</span></div>
  <div class='vr err'><span class='loc'>{m('Unit')}</span>
   <div class='msg'>The sheet says <b>G6, U4</b>; every filename says <b>U3</b>.</div>
   {diff('U3', 'U4', 'Confirm <b>U4</b>')}{ACT}</div>
  <div class='vr err'><span class='loc'>{m('Row 8')}<small>Lesson 4 · Focus</small></span>
   <div class='msg'>{m('RL.6.1, 6.2 L.6.4')} — “6.2” has no strand.</div>
   {diff('RL.6.1, 6.2 L.6.4', 'RL.6.1 · RL.6.2 · L.6.4', 'Proposed')}{ACT}</div>
  <div class='vr err'><span class='loc'>{m('Rows 30, 34, 39')}</span>
   <div class='msg'>{m('RL.6.9.a')} does not exist.</div>
   {diff('RL.6.9.a', None, f"Drop it ({m('RL.6.9')} is already listed)")}{ACT}</div>
  <div class='gh'>{g('warning')}<b>Warnings</b><span class='ct num'>5</span><span class='dim'>Each shows its default</span></div>
  <div class='wr'><span class='loc'>{m('Row 8')}</span><div class='msg'>Note in <i>Foundational Skills</i>: “Instead, think about using morphology…”</div>
   {seg(['Apply', 'Show to reviewer only', 'Ignore'], 'Apply')}</div>
  <div class='wr'><span class='loc'>{m('Row 9')}</span><div class='msg'><i>Text Set Choice</i>: “WRITER MUST SLECT AND WRITE TO AN EXCERPT OF THE TEXT”</div>
   <span class='becomes'>becomes an <b>excerpt slot</b></span></div>
  <div class='wr'><span class='loc'>{m('Row 9')}</span><div class='msg'><i>Vocabulary</i>: “Cap at 6 words per lesson”</div>
   <span class='becomes'><b>unit rule</b> for rows 8–23</span></div>
  <div class='wr'><span class='loc'>{m('Row 8')}</span><div class='msg'>{m('ELD.PII.6.5')} — sheet says “Use transitions to connect ideas”; official strand is <i>Modifying to add details</i></div>
   {seg(['Keep', 'Re-map to PII.6.2b'], 'Keep')}</div>
  <div class='wr'><span class='loc'>{m('Row 39')}</span><div class='msg'><i>Homework</i>: “Warn students about potentially triggering scene in tonight's reading (references to domestic abuse)”</div>
   <span class='becomes'><b>Confirm as a safety flag</b></span></div>
  <div class='gh'>{g('ok')}<b>OK</b></div>
  <div class='okr'><span class='loc'>{m('Row 10')}</span><span>Lesson 6</span>{st('ok', 'OK')}<span class='dim num'>0 warnings</span></div>
 </div>
 <footer class='foot'><span class='why'>{I_LOCK}Generate stays off: 5 errors to confirm</span><span class='btn pri off' aria-disabled='true'>Generate 47 lessons</span></footer>
</section></div>"""


# ---------------------------------------------------------------------------------------------------------------
# M2 · SCR-8 Unit board (FLOW-6)
# ---------------------------------------------------------------------------------------------------------------
ROLL = [("draft", "Draft", 34), ("review", "In review", 6), ("submitted", "Submitted", 2), ("approved", "Approved", 3),
        ("failed", "Failed", 2)]
BAR = "".join(f"<span class='b-{k}' style='flex:{n}'></span>" for k, _, n in ROLL)
LEG = "".join(f"<span>{g(k)}{lbl} <b class='num'>{n}</b></span>" for k, lbl, n in ROLL)
TABS = "<span class='on'>All <b class='num'>47</b></span>" + "".join(f"<span>{lbl} <b class='num'>{n}</b></span>" for _, lbl, n in ROLL)


def blk(n):
    if n in ("—", None):
        return "<span class='dim'>—</span>"
    if n == 0:
        return "<span class='zero num'>0</span>"
    return f"<span class='blk num'>{g('blocking', 12)}{n}</span>"


def adv(n):
    if n in ("—", None):
        return "<span class='dim'>—</span>"
    return f"<span class='num {'zero' if n == 0 else 'advn'}'>{n}</span>"


BOARD_ROWS = [
    ("L4", "Lesson 4: The Lightning Thief, Chapter 1", "Reading", ("review", "In review"), 3, 1, "M. Okafor", "Waits on Lesson 5's excerpt"),
    ("L5", "Lesson 5: Comparing Percy and Soongoora", "Writing", ("submitted", "Submitted"), 0, 2, "J. Rivera", "—"),
    ("L31", "Lesson 31: Comparing the Gods' Home", "Writing", ("draft", "Draft"), 2, 2, "—", f"{g('blocking', 12)} Safety flag open"),
    ("Flex", "Flex Day: Meaning-Making Huddle", "Flex Day", ("draft", "Draft"), 1, 1, "—", f"Standard proposed: {m('RL.6.7')}"),
    ("L22", "Lesson 22", "Reading", ("failed", "Failed"), "—", "—", "—", f"Truncated · <span class='btn sm'>{I_RETRY}Retry</span>"),
    ("L6", "Lesson 6", "Reading", ("approved", "Approved"), 0, 0, "J. Rivera", "Approved · v2"),
]


def who(name):
    if name == "—":
        return "<span class='dim'>—</span>"
    ini = "".join(p[0] for p in name.replace(".", "").split())
    return f"<span class='who'><span class='av'>{ini}</span>{name}</span>"


M2_ROWS = "".join(
    f"<div class='br{' sel' if i == 0 else ''}'><span>{m(rid)}</span><span class='tt'>{title}</span><span class='dim'>{typ}</span>"
    f"<span>{st(*state)}</span><span class='c'>{blk(b)}</span><span class='c'>{adv(a)}</span><span>{who(rv)}</span>"
    f"<span class='bnote'>{note}</span></div>"
    for i, (rid, title, typ, state, b, a, rv, note) in enumerate(BOARD_ROWS))

M2 = f"""<div class='frame' role='img' aria-label='M2 Unit board mockup'>{rail('board')}{side('board')}
<section class='main'>
 <header class='top'><div class='crumbs'><span>Unit 4 · <i>The Lightning Thief</i></span>{I_CHEV}<b>Unit board</b></div>
  <div class='file'><span class='dim num'>47 lessons</span></div></header>
 <div class='titlebar'><h3>Unit 4 · <i>The Lightning Thief</i> <span class='dim num'>· 47 lessons</span></h3></div>
 <div class='m2top'>
  <div class='roll'><p class='lab'>Roll-up</p><div class='bar' aria-hidden='true'>{BAR}</div><div class='leg'>{LEG}</div></div>
  <div class='ns'><p class='lab'>Reviewer minutes per approved lesson</p>
   <div class='nsv'><b class='big num'>24</b><span class='u'>min median</span><span class='nsn num'><i>n</i> = 3</span></div>
   <div class='nsg'><span>fast approvals <b class='num'>0 of 3</b></span><span>approved <b class='num'>3 of 47</b></span></div>
   <p class='cap'>No baseline yet (AQ-14). Measured with us as reviewers.</p></div>
 </div>
 <div class='tabs'>{TABS}<span class='grow'></span><span class='tool'>{I_FILTER}Sorted by blocking issues {I_SORT}</span></div>
 <div class='table'>
  <div class='bh'><span>ID</span><span>Lesson</span><span>Type</span><span>State</span><span class='c'>Blocking {I_SORT}</span><span class='c'>Advisory</span><span>Reviewer</span><span>Note</span></div>
  {M2_ROWS}
  <p class='more dim num'>Showing 6 of 47</p>
 </div>
</section></div>"""


# ---------------------------------------------------------------------------------------------------------------
# M3 · SCR-9 Lesson workspace, Lesson 4 (FLOW-7, WP-1)
# ---------------------------------------------------------------------------------------------------------------
STEPS = ["Draft", "In review", "Submitted", "Approved", "Exported"]
STEPPER = "".join(
    f"<span class='{'done' if i < 1 else ('cur' if i == 1 else '')}'>{g('approved', 12) if i < 1 else (g('review', 12) if i == 1 else g('draft', 12))}{s}</span>"
    + (f"<i>{I_CHEV}</i>" if i < len(STEPS) - 1 else "") for i, s in enumerate(STEPS))

SECTIONS = [
    ("Launch", "5", 0, ""), ("Literacy Lab", "10", 1, ""), ("Learning in Action", "30", 0, "grp"),
    ("Part A", "15", 1, "sub on"), ("Part B", "15", 0, "sub pres"), ("Look Back", "5", 0, ""), ("Homework", "", 1, ""),
]


def sec_row(name, mins, issues, cls):
    badge = f"<span class='ib num'>{g('blocking', 11)}{issues}</span>" if issues else ""
    pres = "<span class='pdot' title='M. Okafor'>MO</span>" if "pres" in cls else ""
    mn = f"<span class='mn num'>{mins}</span>" if mins else "<span class='mn'></span>"
    return f"<div class='sr {cls}'><span class='nm'>{name}</span>{pres}{badge}{mn}</div>"


SEC_ROWS = "".join(sec_row(*s) for s in SECTIONS)

ISSUES = [
    ("blocking", "Blocking", "Quote placeholder open", m("G6.U4.L4.LearningInAction.PartA")),
    ("blocking", "Blocking", "Homework waits on Lesson 5's excerpt", ""),
    ("blocking", "Blocking", f"{m('L.6.4.b')} was chosen by the tool — confirm or remove", ""),
    ("advisory", "Advisory", f"{m('ELD.PII.6.5')} label names another strand", ""),
]
ISSUE_ROWS = "".join(
    f"<div class='is{' first' if i == 0 else ''}'><span class='n num'>{i + 1}</span>{g(k)}<div><span class='k {k}'>{lab}</span> · {t}"
    f"{'<br>' + extra if extra else ''}</div></div>" for i, (k, lab, t, extra) in enumerate(ISSUES))

STD_ROWS = [
    ("RL.6.1", "from the outline", "Part A", "Look Back", False),
    ("RL.6.2", "outline, fixed by A. Chen", "Part B", "Pulse Check", False),
    ("L.6.4.b", "<b>chosen by the tool · confirm</b>", "Literacy Lab", "Literacy Lab check", True),
]
STD_HTML = "".join(
    f"<div class='sd{' flag' if flag else ''}'><span>{m(c)}</span><span>{src}</span><span><i>taught</i> {t}</span><span><i>checked</i> {ck}</span></div>"
    for c, src, t, ck, flag in STD_ROWS)


def m3(label):
    return f"""<div class='frame m3' role='img' aria-label='{label}'>{rail('doc')}
<aside class='side secs'>
 <div class='back'>{I_BACK}<span>Unit board</span></div>
 <p class='sh'>Sections <span class='dim'>min</span></p>{SEC_ROWS}
 <div class='secfoot'><span>{g('blocking', 12)} 3 blocking</span><span>{g('advisory', 12)} 1 advisory</span></div>
</aside>
<section class='main'>
 <header class='lhead'>
  <div class='l1'>{m('L4')}<h3>Lesson 4: The Lightning Thief, Chapter 1</h3><span class='grow'></span><div class='steps'>{STEPPER}</div></div>
  <div class='l2'><span>Reading</span><span class='dot'></span><span class='num'>50 min</span><span class='dot'></span>{st('review', 'In review')}<span class='dot'></span>{m('v3')}
   <span class='grow'></span><span class='pres'><span class='av'>MO</span>{g('presence', 10)}M. Okafor is editing Part B</span></div>
 </header>
 <div class='tabs lt'><span class='on'>Lesson</span><span>Evidence <b class='num'>4</b></span><span>Preview</span><span>Trace</span></div>
 <div class='work'>
  <article class='doc'>
   <p class='sec-h'>Literacy Lab · <span class='num'>10 min</span></p>
   <h4>Introduce New Words Using Morphemes</h4>
   <p><span class='cue'>Say</span>“Today we'll use word parts to unlock new words. The root <i>mort-</i> means death.”</p>
   <p><span class='cue'>Ask</span>“If <i>mort</i> means death, what does <i>immortal</i> mean?”</p>
   <p class='sample'><span class='cue s'>Sample response</span>“Not able to die. <i>Im-</i> means not.”</p>
   <p class='sec-h'>Learning in Action · Part A: Percy's Voice ({m('RL.6.1')}, {m('RL.6.4')}) · <span class='num'>15 min</span></p>
   <div class='ph'><div class='phh'>{g('blocking', 13)}<b>Placeholder</b><span class='dim'>rights: <i>short-quote-commentary</i></span></div>
    <p>Reviewer to insert: one sentence from Ch. 1, pp. 1–8, where Percy's sarcastic word choice sets the tone</p>
    <span class='btn'>{I_QUOTE}Insert quote</span></div>
  </article>
  <aside class='ev'>
   <div class='evh'><b>Issues</b><span class='dim num'>3 blocking, 1 advisory</span></div>
   {ISSUE_ROWS}
   <div class='evh s2'><b>Standards</b><span class='dim num'>3</span></div>
   {STD_HTML}
   <div class='off'><p class='lab'>Official text of {m('L.6.4.b')}</p><p>“Use common, grade-appropriate Greek or Latin affixes and roots as clues to the meaning of a word (e.g., audience, auditory, audible).”</p></div>
  </aside>
 </div>
 <footer class='foot'><span class='why small'>{I_EYE}Active review time on this lesson is recorded and shown only as unit totals.</span>
  <span class='blkc'>{g('blocking', 13)}3 blocking issues</span><span class='btn pri off' aria-disabled='true'>Submit for approval</span></footer>
</section></div>"""


# ---------------------------------------------------------------------------------------------------------------
# M4 · SCR-14 Approval review, Lesson 5 (FLOW-12, WP-2)
# ---------------------------------------------------------------------------------------------------------------
CHECKS = [
    ("Quotes and excerpts", "excerpt inserted by J. Rivera from <i>Zanzibar Tales</i> (Bateman trans.) · rights: public-domain · source recorded"),
    ("Standards taught and checked", f"{m('W.6.2.a')}, {m('W.6.2.b')}, {m('W.6.2.f')} confirmed by J. Rivera"),
    ("ELD supports keep the same text and task", ""),
    ("Social content reviewed", ""),
    ("AI-assisted spans", "1 accepted by J. Rivera"),
]
CHECK_ROWS = "".join(
    f"<div class='ck'>{g('ok', 16)}<div><b>{t}</b>{'<span class=\"evd\">' + e + '</span>' if e else ''}</div><span class='pass'>Pass</span></div>"
    for t, e in CHECKS)


def radio(label, on=False):
    return f"<div class='rd{' on' if on else ''}'><span class='rc'></span>{label}</div>"


M4 = f"""<div class='frame' role='img' aria-label='M4 Approval review mockup'>{rail('approve')}{side('submitted')}
<section class='main'>
 <header class='lhead'>
  <div class='l1'>{m('L5')}<h3>Lesson 5: Comparing Percy and Soongoora</h3></div>
  <div class='l2'><span>Writing</span><span class='dot'></span>{st('submitted', 'Submitted')}<span>by J. Rivera</span><span class='dot'></span><span class='dim'>snapshot</span>{m('9f3c…a21e')}</div>
 </header>
 <div class='tabs lt'><span>Lesson</span><span class='on'>Evidence</span><span>Preview</span><span>Trace</span></div>
 <div class='note-bar'>{I_LINK}Lesson 4 is waiting on this lesson's excerpt.</div>
 <div class='apv'>
  <div class='cl'><div class='evh'><b>Checklist</b><span class='dim num'>5 of 5</span></div>{CHECK_ROWS}</div>
  <aside class='dec'>
   <div class='eyes'>{g('ok', 14)}<span>You did not edit this lesson, so you can approve it.</span></div>
   <p class='lab'>Draft quality <span class='req'>required</span></p>
   {radio('Usable as drafted')}{radio('<b>Usable with edits</b>', True)}{radio('Rewritten')}
   <span class='btn pri wide'>Approve this version</span>
   <span class='btn wide'>Request changes</span>
   <p class='fine'>Approving pins snapshot {m('9f3c…a21e')}. If it changes before you approve, you'll be asked to reload.</p>
  </aside>
 </div>
</section></div>"""


# ---------------------------------------------------------------------------------------------------------------
# Construction CSS. Every mockup colour reads var(--token); hairlines, no shadows, 6 px radius, 32 px rows.
# ---------------------------------------------------------------------------------------------------------------
MOCK_CSS = """
.scroller{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;padding-bottom:6px;margin:0 -2px}
.frame{--mono:ui-monospace,'SF Mono','JetBrains Mono',Menlo,Consolas,monospace;width:1200px;height:760px;display:grid;grid-template-columns:52px 224px minmax(0,1fr);
 background:var(--ground);color:var(--ink);border:1px solid var(--hair);border-radius:10px;overflow:hidden;font:13px/1.45 var(--sans);letter-spacing:-.003em;text-align:left}
.frame{grid-template-rows:minmax(0,1fr)}.frame>*{min-height:0}
.frame.m3{grid-template-columns:52px 212px minmax(0,1fr)}
.frame .num{font-variant-numeric:tabular-nums}
.frame .m{font-family:var(--mono);font-size:12px;color:var(--ink);background:var(--well);border:1px solid var(--hair);border-radius:4px;padding:0 4px;white-space:nowrap;letter-spacing:0}
.frame .dim{color:var(--ink2)}
.frame .g{flex:none;display:inline-block;vertical-align:-2px}
.frame .i{flex:none}
.st{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.grow{flex:1}
/* rail + sidebar */
.rail{background:var(--rail);border-right:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:12px 0;gap:4px;color:var(--ink2)}
.logo{width:30px;height:30px;border-radius:7px;background:var(--ink);color:var(--ground);font:700 11px/30px var(--sans);text-align:center;letter-spacing:.02em;margin-bottom:12px}
.ri{width:34px;height:34px;border-radius:6px;display:flex;align-items:center;justify-content:center}
.ri.on{background:var(--selected);color:var(--ink)}
.side{background:var(--side);border-right:1px solid var(--hair);padding:12px 8px;display:flex;flex-direction:column;gap:1px;min-width:0}
.ws{display:flex;align-items:center;gap:9px;padding:4px 6px 12px;border-bottom:1px solid var(--hair);margin-bottom:6px;color:var(--ink2)}
.ws div{display:flex;flex-direction:column;line-height:1.25;flex:1;min-width:0}.ws b{color:var(--ink);font-weight:600}.ws small{font-size:12px;color:var(--ink2);font-style:italic}
.wsm{width:26px;height:26px;border-radius:6px;background:var(--well);border:1px solid var(--hair);font:600 11px/24px var(--mono);text-align:center;color:var(--ink)}
.sh{margin:12px 8px 4px;font-size:11.5px;font-weight:600;color:var(--ink2);letter-spacing:.02em;display:flex;justify-content:space-between}
.si{height:30px;display:flex;align-items:center;gap:9px;padding:0 8px;border-radius:6px;color:var(--ink)}
.si .i{color:var(--ink2)}.si .lbl{flex:1}.si .ct{color:var(--ink2);font-size:12px}
.si.on{background:var(--selected)}.si.on .i{color:var(--ink)}
.ctd{width:6px;height:6px;border-radius:2px;background:var(--danger);margin-left:-4px}
/* main column */
.main{display:flex;flex-direction:column;min-width:0;background:var(--panel)}
.top{height:44px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 18px;border-bottom:1px solid var(--hair);color:var(--ink2)}
.crumbs{display:flex;align-items:center;gap:8px;white-space:nowrap}.crumbs b{color:var(--ink);font-weight:600}
.file{display:flex;align-items:center;gap:7px;white-space:nowrap}
.titlebar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 18px;border-bottom:1px solid var(--hair);flex:none}
.titlebar h3,.lhead h3{margin:0;font-size:16px;font-weight:600;letter-spacing:-.01em}
.stats{display:flex;align-items:center;gap:12px;white-space:nowrap;color:var(--ink2)}.stats b{color:var(--ink);font-weight:600;margin-right:3px}
.stats span{display:inline-flex;align-items:center;gap:6px}.stats .bad b{color:var(--danger)}.stats .bad{color:var(--ink)}
.stats .sep{width:1px;height:14px;background:var(--hair)}
/* grouped list (M1) */
.list{flex:1;overflow:hidden}
.gh{height:30px;display:flex;align-items:center;gap:8px;padding:0 18px;background:var(--well);border-bottom:1px solid var(--hair);font-size:12.5px}
.gh b{font-weight:600}.gh .ct{color:var(--ink2)}.gh .dim{margin-left:6px;font-size:12px}
.vr,.wr,.okr{display:grid;align-items:center;gap:14px;padding:0 18px;border-bottom:1px solid var(--hair)}
.vr{grid-template-columns:168px minmax(0,1fr) 236px 116px;min-height:52px;padding-top:6px;padding-bottom:6px}
.wr{grid-template-columns:168px minmax(0,1fr) auto;min-height:36px;padding-top:4px;padding-bottom:4px}
.okr{grid-template-columns:168px auto auto 1fr;height:32px}
.loc{min-width:0;overflow:hidden}.loc small{display:block;font-size:12px;color:var(--ink2);margin-top:3px}
.msg{min-width:0}
.diff{font:12px/1.35 var(--mono);display:flex;flex-direction:column;gap:2px;min-width:0}
.dl{display:flex;gap:6px;border-radius:3px;padding:1px 6px;white-space:nowrap;overflow:hidden;color:var(--ink)}
.dl i{font-style:normal;width:8px;flex:none}.dl code{font:inherit}
.dl.del{background:var(--del)}.dl.del i{color:var(--danger)}.dl.del code{text-decoration:line-through;text-decoration-color:var(--danger)}
.dl.add{background:var(--add)}.dl.add i{color:var(--ok)}
.dnote{font:12px/1.35 var(--sans);color:var(--ink2);padding-left:20px}.dnote b{color:var(--ink)}.dnote .m{font-size:11px;background:none;border:0;padding:0;color:var(--ink)}
.acts{display:flex;gap:6px;justify-content:flex-end}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:26px;padding:0 10px;border-radius:6px;border:1px solid var(--edge);color:var(--ink);background:var(--panel);font-weight:500;font-size:12.5px;white-space:nowrap}
.btn.ghost{border-color:transparent;color:var(--ink2)}
.btn.sm{height:22px;padding:0 7px;font-size:12px;margin-left:4px}
.btn.pri{background:var(--primary);border-color:var(--primary);color:var(--on-primary);font-weight:600;height:32px;padding:0 14px}
.btn.pri.off{background:var(--well);border-color:var(--hair);color:var(--ink2)}
.seg{display:inline-flex;border:1px solid var(--edge);border-radius:6px;overflow:hidden;white-space:nowrap;font-size:12px}
.seg span{padding:3px 9px;color:var(--ink2);border-left:1px solid var(--hair)}.seg span:first-child{border-left:0}
.seg .on{background:var(--selected);color:var(--ink);font-weight:600}
.becomes{color:var(--ink2);white-space:nowrap;font-size:12.5px}.becomes b{color:var(--ink);font-weight:600}
.foot{height:56px;flex:none;display:flex;align-items:center;justify-content:flex-end;gap:16px;padding:0 18px;border-top:1px solid var(--hair);background:var(--panel)}
.why{display:inline-flex;align-items:center;gap:7px;color:var(--ink2);margin-right:auto}.why.small{font-size:12px}
/* M2 */
.m2top{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:0;border-bottom:1px solid var(--hair);flex:none}
.roll{padding:14px 18px;border-right:1px solid var(--hair)}
.lab{margin:0 0 8px;font-size:11.5px;font-weight:600;color:var(--ink2);letter-spacing:.02em}
.bar{display:flex;height:8px;border-radius:3px;overflow:hidden;gap:2px;margin-bottom:12px}
.bar span{display:block}.b-draft{background:var(--edge)}.b-review{background:var(--amber)}.b-submitted{background:var(--blue)}.b-approved{background:var(--ok)}.b-failed{background:var(--danger)}
.leg{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--ink2)}.leg span{display:inline-flex;align-items:center;gap:6px}.leg b{color:var(--ink);font-weight:600}
.ns{padding:14px 18px}
.nsv{display:flex;align-items:baseline;gap:8px}.nsv .big{font:600 28px/1 var(--mono);letter-spacing:-.02em}.nsv .u{color:var(--ink2)}
.nsn{margin-left:auto;font:12px var(--mono);color:var(--ink2)}
.nsg{display:flex;gap:14px;margin-top:8px;color:var(--ink2);font-size:12.5px}.nsg b{color:var(--ink);font-weight:600}
.cap{margin:8px 0 0;font-size:12px;color:var(--ink2)}
.tabs{display:flex;align-items:center;gap:20px;padding:0 18px;border-bottom:1px solid var(--hair);height:40px;flex:none;color:var(--ink2)}
.tabs span{display:inline-flex;align-items:center;gap:5px;height:100%;border-bottom:2px solid transparent;margin-bottom:-1px}
.tabs b{font-weight:500;font-size:12px;color:var(--ink2)}
.tabs .on{color:var(--ink);font-weight:600;border-bottom-color:var(--ink)}.tabs .on b{color:var(--ink)}
.tabs .tool{border:0;font-size:12px;gap:6px}
.table{flex:1;overflow:hidden}
.bh,.br{display:grid;grid-template-columns:44px minmax(0,1.45fr) 60px 100px 66px 60px 100px minmax(0,1.25fr);gap:10px;align-items:center;padding:0 18px}
.bh{height:32px;color:var(--ink2);font-size:12px;font-weight:500;border-bottom:1px solid var(--hair);background:var(--panel)}
.bh span{display:inline-flex;align-items:center;gap:4px}
.br{min-height:46px;padding-top:5px;padding-bottom:5px;border-bottom:1px solid var(--hair)}
.br.sel{background:var(--well);box-shadow:inset 2px 0 0 var(--ink)}
.br .tt{font-weight:500;line-height:1.3}
.c{justify-content:center;text-align:center;display:flex}
.blk{display:inline-flex;align-items:center;gap:5px;color:var(--danger);font-weight:600}
.zero{color:var(--ink2)}.advn{color:var(--ink)}
.who{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.av{width:20px;height:20px;border-radius:50%;background:var(--selected);border:1px solid var(--hair);font:600 9.5px/18px var(--sans);text-align:center;color:var(--ink);flex:none}
.bnote{color:var(--ink2);line-height:1.35;font-size:12.5px}.bnote .g{margin-right:4px}
.more{margin:0;padding:10px 18px;font-size:12px}
/* M3 */
.secs{padding-top:10px}
.back{display:flex;align-items:center;gap:6px;color:var(--ink2);padding:4px 6px 10px;border-bottom:1px solid var(--hair);margin-bottom:4px}
.sr{height:32px;display:flex;align-items:center;gap:8px;padding:0 8px;border-radius:6px}
.sr .nm{flex:1;white-space:nowrap}.sr.grp .nm{color:var(--ink2);font-weight:500}
.sr.sub{padding-left:22px}.sr.on{background:var(--selected)}
.sr .mn{width:22px;text-align:right;color:var(--ink2);font:12px var(--mono)}
.ib{display:inline-flex;align-items:center;gap:4px;font:600 11.5px var(--mono);color:var(--danger)}
.pdot{width:18px;height:18px;border-radius:50%;background:var(--add);border:1px solid var(--ok);font:600 8.5px/16px var(--sans);text-align:center;color:var(--ink)}
.secfoot{margin-top:auto;display:flex;flex-direction:column;gap:6px;padding:10px 8px 2px;border-top:1px solid var(--hair);color:var(--ink2);font-size:12px}
.secfoot span{display:inline-flex;align-items:center;gap:7px}
.lhead{padding:12px 18px 12px;flex:none}
.l1{display:flex;align-items:center;gap:10px}
.l2{display:flex;align-items:center;gap:9px;margin-top:6px;color:var(--ink2);white-space:nowrap}
.l2 .st{color:var(--ink)}
.dot{width:3px;height:3px;border-radius:50%;background:var(--edge)}
.pres{display:inline-flex;align-items:center;gap:7px;color:var(--ink);font-size:12.5px;background:var(--well);border:1px solid var(--hair);border-radius:6px;padding:2px 9px 2px 3px}
.steps{display:flex;align-items:center;gap:6px;color:var(--ink2);font-size:12px;white-space:nowrap}
.steps span{display:inline-flex;align-items:center;gap:5px}.steps .cur{color:var(--ink);font-weight:600}.steps .done{color:var(--ink)}
.steps i{display:inline-flex;color:var(--edge)}
.tabs.lt{gap:22px}
.work{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 372px;min-height:0}
.doc{padding:18px 30px 0 34px;max-width:68ch;overflow:hidden;font-size:14px;line-height:1.6}
.doc p{margin:0 0 10px}
.sec-h{font-size:11.5px!important;font-weight:600;color:var(--ink2);letter-spacing:.02em;margin:0 0 6px!important;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sec-h .m{font-size:11px;background:none;border:0;padding:0;color:var(--ink2)}
.doc h4{margin:0 0 10px;font-size:15.5px;font-weight:600;letter-spacing:-.01em}
.cue{display:inline-block;min-width:44px;font:600 11px/1 var(--mono);color:var(--ink2);margin-right:8px;text-transform:uppercase;letter-spacing:.04em}
.sample{padding-left:12px;border-left:2px solid var(--hair);color:var(--ink2)}.cue.s{min-width:0}
.doc .sample{margin-bottom:20px}
.ph{border:1px dashed var(--danger);background:var(--danger-tint);border-radius:6px;padding:10px 12px}
.phh{display:flex;align-items:center;gap:7px;font-size:12px;margin-bottom:4px}.phh .dim{margin-left:auto}
.ph p{margin:0 0 10px;font-size:13.5px}
.ev{border-left:1px solid var(--hair);background:var(--side);padding:0 0 10px;overflow:hidden;font-size:12.5px}
.evh{display:flex;align-items:baseline;justify-content:space-between;padding:12px 16px 6px}.evh b{font-weight:600;font-size:13px}.evh.s2{padding-top:14px;border-top:1px solid var(--hair);margin-top:4px}
.is{display:grid;grid-template-columns:14px 14px minmax(0,1fr);gap:8px;align-items:start;padding:6px 16px;line-height:1.45}
.is .g{margin-top:2px}.is .n{color:var(--ink2);font:11.5px/19px var(--mono)}
.is.first{background:var(--selected);box-shadow:inset 2px 0 0 var(--danger)}
.k{font-weight:600}.k.blocking{color:var(--danger)}.k.advisory{color:var(--ink)}
.is .m{font-size:11px}
.sd{display:grid;grid-template-columns:62px minmax(0,1fr);gap:2px 10px;padding:6px 16px;border-top:1px solid var(--hair)}
.sd span:nth-child(2){color:var(--ink2)}.sd span:nth-child(3),.sd span:nth-child(4){grid-column:2;font-size:12px}
.sd i{font-style:normal;color:var(--ink2);margin-right:4px}
.sd.flag span:nth-child(2){color:var(--danger)}.sd.flag span:nth-child(2) b{font-weight:600}
.off{margin:8px 16px 0;padding:8px 10px;border:1px solid var(--hair);border-radius:6px;background:var(--panel)}
.off .lab{margin-bottom:4px}.off p{margin:0;line-height:1.45}
.blkc{display:inline-flex;align-items:center;gap:6px;color:var(--danger);font-weight:600;white-space:nowrap}
/* M4 */
.note-bar{display:flex;align-items:center;gap:8px;margin:12px 18px 0;padding:8px 12px;border:1px solid var(--hair);border-radius:6px;background:var(--well);color:var(--ink);flex:none}
.note-bar .i{color:var(--blue)}
.apv{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;padding:16px 18px 18px;min-height:0}
.cl{border:1px solid var(--hair);border-radius:8px;overflow:hidden;align-self:start}
.cl .evh{padding:10px 14px;border-bottom:1px solid var(--hair);background:var(--well)}
.ck{display:grid;grid-template-columns:16px minmax(0,1fr) auto;gap:12px;align-items:start;padding:15px 16px;border-bottom:1px solid var(--hair)}
.ck:last-child{border-bottom:0}.ck .g{margin-top:2px}
.ck b{font-weight:600;display:block}.evd{display:block;color:var(--ink2);font-size:12.5px;margin-top:2px}
.pass{font:600 11px var(--mono);color:var(--ok);letter-spacing:.04em;text-transform:uppercase;margin-top:2px}
.dec{border:1px solid var(--hair);border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:9px;align-self:stretch;background:var(--side)}
.eyes{display:flex;gap:9px;align-items:flex-start;padding:0 0 12px;border-bottom:1px solid var(--hair);margin-bottom:4px}.eyes .g{margin-top:2px}
.req{font-weight:500;color:var(--ink2);margin-left:6px;text-transform:none;letter-spacing:0}
.rd{height:38px;display:flex;align-items:center;gap:10px;padding:0 10px;border:1px solid var(--hair);border-radius:6px;background:var(--panel)}
.rd.on{border-color:var(--edge);background:var(--selected)}.rd b{font-weight:600}
.rc{width:14px;height:14px;border-radius:50%;border:1.5px solid var(--edge);flex:none}.rd.on .rc{border:4.5px solid var(--ink)}
.btn.wide{width:100%;height:34px}
.dec .btn.pri{margin-top:auto}
.fine{margin:4px 0 0;font-size:12px;color:var(--ink2);line-height:1.45}.fine .m{font-size:11px}
"""

# Page chrome: dark-first (D2's primary), with a light page under prefers-color-scheme: light.
PAGE_CSS = """
:root{color-scheme:dark light;--sans:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI Variable Text','Segoe UI',system-ui,'Helvetica Neue',sans-serif;
 --pg-bg:#0B0C0E;--pg-card:#131417;--pg-ink:#EDEDEF;--pg-ink2:#A1A1AA;--pg-hair:#26272B;--pg-accent:#3DD68C;--pg-link:#8FB3FF}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--pg-bg:#F4F4F5;--pg-card:#FFFFFF;--pg-ink:#111113;--pg-ink2:#55555E;--pg-hair:#E4E4E7;--pg-accent:#12804F;--pg-link:#2F5BD3}}
:root[data-theme="dark"]{--pg-bg:#0B0C0E;--pg-card:#131417;--pg-ink:#EDEDEF;--pg-ink2:#A1A1AA;--pg-hair:#26272B;--pg-accent:#3DD68C;--pg-link:#8FB3FF}
*{box-sizing:border-box}
body{margin:0;background:var(--pg-bg);color:var(--pg-ink);font:15px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
.page{max-width:1264px;margin:0 auto;padding:32px 16px 72px}
code{font-family:ui-monospace,'SF Mono','JetBrains Mono',Menlo,Consolas,monospace;font-size:.9em}
.kicker{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;font:500 12px/1 ui-monospace,'SF Mono',Menlo,monospace;color:var(--pg-ink2);letter-spacing:.02em}
.kicker span{border:1px solid var(--pg-hair);border-radius:4px;padding:5px 8px;background:var(--pg-card)}
.kicker .st{color:var(--pg-ink)}.kicker .st::before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;border:1.5px dashed var(--pg-ink2);margin-right:6px;vertical-align:-1px}
h1{font-size:34px;line-height:1.1;margin:0 0 8px;font-weight:650;letter-spacing:-.025em;text-wrap:balance}
h1 em{font-style:normal;color:var(--pg-ink2);font-weight:500}
.intent{font-size:19px;margin:0 0 12px;color:var(--pg-ink);text-wrap:balance}
.lede{color:var(--pg-ink2);margin:0;max-width:78ch;text-wrap:pretty}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1px;background:var(--pg-hair);border:1px solid var(--pg-hair);border-radius:8px;overflow:hidden;margin:22px 0 0}
.facts div{background:var(--pg-card);padding:10px 12px;font-size:13px}.facts b{display:block;font-size:11.5px;font-weight:600;color:var(--pg-ink2);letter-spacing:.03em;text-transform:uppercase;margin-bottom:2px}
section.s{margin:44px 0 0}
section.s>h2{font-size:20px;margin:0 0 4px;font-weight:620;letter-spacing:-.01em}
.note{color:var(--pg-ink2);margin:0 0 14px;max-width:84ch;font-size:14px;text-wrap:pretty}
.mock{margin:0 0 28px}
.mock h3{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;font-size:14px;font-weight:600;margin:0 0 8px}
.mock h3 code{color:var(--pg-ink2);font-weight:500}.mock h3 span{color:var(--pg-ink2);font-weight:400}
.palettes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px}
.pal{border-radius:10px;padding:16px;border:1px solid var(--pg-hair)}.pal h3{margin:0 0 12px;font-size:15px}
.sws{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 8px}
.sw{font-size:12px;display:flex;flex-direction:column;gap:2px;min-width:0}.sw b{font-weight:600;overflow-wrap:anywhere}
.sw span{height:34px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(127,127,127,.3)}.sw code{opacity:.8;font-size:11px}
table{border-collapse:collapse;width:100%;font-size:12.5px;margin-top:14px}
td{padding:3px 6px;border-top:1px solid rgba(127,127,127,.22)}td.num{font-variant-numeric:tabular-nums;font-family:ui-monospace,'SF Mono',Menlo,monospace;white-space:nowrap}
tr.ui td{font-style:italic}
.chk{width:100%;border:1px solid var(--pg-hair);border-radius:8px;overflow:hidden;background:var(--pg-card);font-size:13.5px;margin:0}
.chk td,.chk th{padding:8px 12px;border-top:1px solid var(--pg-hair);text-align:left;vertical-align:top}.chk th{font-size:12px;color:var(--pg-ink2);font-weight:600;border-top:0}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:16px}
.shot{margin:0;background:var(--pg-card);border:1px solid var(--pg-hair);border-radius:10px;overflow:hidden}
.shot img{width:100%;display:block;aspect-ratio:4/3;object-fit:cover;background:#000}
.shot figcaption{padding:10px 12px 12px;font-size:13px}
.shot .id{font:600 11.5px ui-monospace,'SF Mono',Menlo,monospace;color:var(--pg-ink2)}
.shot .why{color:var(--pg-ink);display:block;margin-top:4px}.shot .feel{color:var(--pg-ink2);display:block;font-size:12.5px}
.shot a{color:var(--pg-link);word-break:break-all;font-size:12px}
.tag{display:inline-block;font-size:11px;font-weight:600;color:var(--pg-ink2);border:1px solid var(--pg-hair);border-radius:4px;padding:0 5px;margin-left:4px}
footer.pf{margin-top:48px;padding-top:16px;border-top:1px solid var(--pg-hair);color:var(--pg-ink2);font-size:13px}
@media (max-width:520px){h1{font-size:28px}.intent{font-size:17px}.sws{grid-template-columns:repeat(3,minmax(0,1fr))}}
"""


def page():
    dk, lt = css_vars(DARK), css_vars(LIGHT)
    shots = "".join(
        f"<figure class='shot'><img src='{img(f)}' alt='{t} by {d}'><figcaption><span class='id'>{f[:5]}</span> · <b>{t}</b> — {d}"
        f"<span class='tag'>internal reference only</span><span class='why'>Why kept: {why}</span>"
        f"<span class='feel'>Feel-brief line: {feel}</span><a href='{u}'>{u}</a></figcaption></figure>"
        for f, t, d, u, why, feel in SHOTS)

    def mock(code, title, flow, html, pal):
        return (f"<div class='mock'><h3><code>{code}</code>{title}<span>{flow}</span></h3>"
                f"<div class='scroller' style='{pal}'>{html}</div></div>")

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>D2 Night Desk look sheet</title><style>{PAGE_CSS}{MOCK_CSS}</style></head>
<body><main class="page">
<p class="kicker"><span>UX-2 · look sheet</span><span class="st">Status: proposal</span><span>{DATE}</span><span>Newsela Lesson Studio</span></p>
<h1>{DIRECTION} · {NAME} <em>· dark-first</em></h1>
<p class="intent">{INTENT}</p>
<p class="lede">This is a static look; linked-screen prototypes come only for the directions you shortlist. Nothing here is clickable.
<b>Night Desk is dark-first:</b> the four desktop mockups below are drawn on its dark palette (the primary theme), and M3 is repeated in the light twin.
Same four screens and the same words as the other directions' sheets (<code>LOOK_SHEET_COPY.md</code>), so only the look changes. People's names and counts are synthetic.</p>
<div class="facts"><div><b>Softness</b>hard: 6 px radius, hairlines, no shadow</div><div><b>Density</b>dense: 32 px rows, grouped lists</div>
<div><b>Shape</b>rows, groups, tabs, mono IDs</div><div><b>Temperature</b>cool graphite + signal green</div><div><b>Type</b>system grotesk + monospace IDs and numbers</div></div>

<section class="s"><h2>Mockups, dark (the primary theme)</h2>
<p class="note">Desktop width, about 1200 × 760. Status is always a glyph shape plus a word: dashed ring = Draft, half-filled ring = In review, three-quarter ring = Submitted, filled check = Approved, filled cross = Failed or error, octagon = blocking, triangle = warning. Red appears only on what blocks; signal green only on the one primary action and on passed checks. On a narrow screen, scroll each frame sideways.</p>
{mock('M1', 'Validation report', 'SCR-4 · FLOW-3', M1, dk)}
{mock('M2', 'Unit board', 'SCR-8 · FLOW-6', M2, dk)}
{mock('M3', 'Lesson 4 workspace', 'SCR-9 · FLOW-7 · WP-1', m3('M3 Lesson 4 workspace mockup, dark'), dk)}
{mock('M4', 'Lesson 5 approval', 'SCR-14 · FLOW-12 · WP-2', M4, dk)}
</section>

<section class="s"><h2>M3 again, in the light twin</h2>
<p class="note">The same construction on D2's light palette. Panels stay white on a near-white ground; the primary green darkens to <code>{LIGHT['primary']}</code> so white text on it passes.</p>
{mock('M3', 'Lesson 4 workspace', 'light twin', m3('M3 Lesson 4 workspace mockup, light'), lt)}
</section>

<section class="s"><h2>Palette (proposal; UX-3 makes it exact)</h2>
<p class="note">The six base tokens per mode (ground, panel, well, ink, ink2, primary) are the <code>DESIGN-DIRECTIONS.md</code> values, unchanged. The rest are added for this construction: rail and side for the navigation, selected, hair (decorative row dividers, not a control edge, so not checked), edge (control borders, checked at 3:1), status hues for glyphs, and the diff tints. Contrast is computed from these hex values with the WCAG formula; the build fails if any text pair is under 4.5:1 or any UI part under 3:1.</p>
<div class="palettes">
<div class="pal" style="background:{DARK['ground']};color:{DARK['ink']}"><h3>Dark (primary)</h3><div class="sws">{swatches(DARK)}</div><table>{contrast_rows(DARK)}</table></div>
<div class="pal" style="background:{LIGHT['panel']};color:{LIGHT['ink']}"><h3>Light twin</h3><div class="sws">{swatches(LIGHT)}</div><table>{contrast_rows(LIGHT)}</table></div>
</div></section>

<section class="s"><h2>House-texture check</h2>
<table class="chk"><tr><th>Trait to avoid</th><th>On this sheet</th></tr>
<tr><td>Cream canvas</td><td>No: graphite ground <code>{DARK['ground']}</code>; the light twin is a neutral <code>{LIGHT['ground']}</code></td></tr>
<tr><td>Serif headings</td><td>No: system grotesk throughout, monospace only for IDs and numbers</td></tr>
<tr><td>Outlined pills</td><td>No: status is filled or ringed glyph circles with a word; controls are 6 px rectangles</td></tr>
<tr><td>Sage accent</td><td>No: signal green <code>{DARK['primary']}</code>, used only for the primary action and passed checks</td></tr></table>
</section>

<section class="s"><h2>The {len(SHOTS)} references behind D2</h2>
<p class="note">Other designers' published Dribbble work, kept as internal reference only and not copied into the product. Credits from <code>docs/design/references/_index.json</code>; reasons from <code>docs/ux/02-concepts/REFERENCES.md</code>. Images are downscaled copies embedded in this file.</p>
<div class="shots">{shots}</div></section>

<footer class="pf">Local file, not published. Rebuild: <code>python3 docs/artifacts/_build/d2-look/build_d2_look.py</code> (from the repo root).</footer>
</main></body></html>"""


if __name__ == "__main__":
    failures = []
    for mode, pal in (("dark", DARK), ("light", LIGHT)):
        for fg, bg in TEXT_PAIRS:
            if ratio(pal[fg], pal[bg]) < 4.5:
                failures.append(f"{mode}: text {fg} on {bg} {ratio(pal[fg], pal[bg]):.2f}:1 (needs 4.5)")
        for fg, bg in UI_PAIRS:
            if ratio(pal[fg], pal[bg]) < 3:
                failures.append(f"{mode}: UI {fg} on {bg} {ratio(pal[fg], pal[bg]):.2f}:1 (needs 3)")
    if failures:
        print("CONTRAST FAIL\n" + "\n".join(failures))
        sys.exit(1)
    OUT.write_text(page())
    print(OUT, f"{OUT.stat().st_size / 1e6:.2f} MB")
    for mode, pal in (("dark", DARK), ("light", LIGHT)):
        wt = min((ratio(pal[a], pal[b]), f"{a} on {b}") for a, b in TEXT_PAIRS)
        wu = min((ratio(pal[a], pal[b]), f"{a} on {b}") for a, b in UI_PAIRS)
        print(f"{mode}: lowest text pair {wt[1]} {wt[0]:.2f}:1 · lowest UI part {wu[1]} {wu[0]:.2f}:1")
