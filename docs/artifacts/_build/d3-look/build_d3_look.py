"""Build the D3 · Soft Studio look sheet (UX-2): four static desktop mockups, M3 again in dark, palette with
computed contrast, and the credited D3 references embedded as data URIs.

Copied from the ux-pipeline starter (templates/look_sheet_generator.py) and filled for Newsela Lesson Studio.
Run:     python3 docs/artifacts/_build/d3-look/build_d3_look.py
Writes:  docs/artifacts/2026-10-25-d3-soft-studio-look-sheet.html (static, offline, no JS, images embedded)

Copy:    docs/ux/02-concepts/LOOK_SHEET_COPY.md (M1-M4, word for word; the only added line is the M2 greeting).
Look:    docs/design/DESIGN-DIRECTIONS.md, D3 column, D3 component anatomy and D3 palettes.
Images:  docs/design/references/d3-*.jpg, downscaled to <= 900 px wide at JPEG q80 with macOS `sips` into a scratch
         folder (LOOK_SCRATCH env var, else a temp dir); if `sips` is missing the originals are embedded.
Exit 1 if any text pair is under 4.5:1 or any UI edge is under 3:1. Palette values are a proposal; UX-3 makes them exact.
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

# ---------------------------------------------------------------- identity
DIRECTION = "D3"
NAME = "Soft Studio"
INTENT = "A friendly team space that makes review feel shared."
DATE = "2026-10-25"
OUT = DOCS / "artifacts" / f"{DATE}-d3-soft-studio-look-sheet.html"

# ---------------------------------------------------------------- references (credits: references/_index.json;
# why kept + feel line: docs/ux/02-concepts/REFERENCES.md)
SHOTS = [
    ("d3-01-nexus-collaborative-team-inbox-dashboard.jpg", "Nexus — Collaborative Team Inbox Dashboard", "Irzha Nabhan",
     "https://dribbble.com/shots/27609147-Nexus-Collaborative-Team-Inbox-Dashboard",
     "Three-pane inbox; approval checklist '2 of 3 approved'", "shared; accountable"),
    ("d3-02-ui-ux-design-document-editor-dashboard-i.jpg", "UI UX Design Document Editor Dashboard - Inkwise", "Phenomenon Studio",
     "https://dribbble.com/shots/27222028-UI-UX-Design-Document-Editor-Dashboard-Inkwise",
     "Doc dashboard on a periwinkle wash; recent documents as cards", "warm; calm"),
    ("d3-03-ai-powered.jpg", "AI-powered", "Zendeeps",
     "https://dribbble.com/shots/27603929-AI-powered-bug-tracking-and-auto-patching-tool",
     "Greeting header; 'awaiting review' and 'blocked' counts", "warm; calm"),
    ("d3-04-comments.jpg", "Comments", "Eugen Eşanu",
     "https://dribbble.com/shots/19892151-Comments-empty-state",
     "Comments composer with a floating format bar", "shared"),
    ("d3-05-poptutore.jpg", "PopTutore", "Lathiya",
     "https://dribbble.com/shots/27135060-PopTutore",
     "Soft tinted stat tiles", "warm"),
    ("d3-06-inbox-dashboard.jpg", "Inbox Dashboard", "Ahmed Safayet",
     "https://dribbble.com/shots/26980572-Inbox-Dashboard",
     "Inbox list beside a reading pane", "calm"),
]

# ---------------------------------------------------------------- palettes
# Core seven per mode are DESIGN-DIRECTIONS.md's D3 light / D3 dark, unchanged. The rest (selected, hair, the soft
# status tints and their inks) are added here at the same hues, then checked below.
LIGHT = {
    "ground": "#EEF0FB", "panel": "#FFFFFF", "well": "#F5F6FD", "selected": "#E7E8FC", "hair": "#E3E5F4",
    "ink": "#1C1D35", "ink2": "#535675", "primary": "#4B48D6", "on-primary": "#FFFFFF",
    "primary-soft": "#ECEBFE", "primary-ink": "#3E3BC0",
    "danger": "#C42550", "on-danger": "#FFFFFF", "danger-soft": "#FDE8EE", "danger-ink": "#A8183F",
    "warn-soft": "#FFF0DE", "warn-ink": "#8A4A00",
    "ok-soft": "#DEF5EB", "ok-ink": "#13694A",
    "sky-soft": "#E1F0FF", "sky-ink": "#1A5A8F",
}
DARK = {
    "ground": "#14152A", "panel": "#1D1F38", "well": "#262947", "selected": "#30336A", "hair": "#2F3256",
    "ink": "#EEEEFB", "ink2": "#B4B6D6", "primary": "#A5A8FF", "on-primary": "#14152A",
    "primary-soft": "#2E3068", "primary-ink": "#CFD0FF",
    "danger": "#FF8EA8", "on-danger": "#1A0D16", "danger-soft": "#41203A", "danger-ink": "#FFBCCB",
    "warn-soft": "#3D2E1E", "warn-ink": "#FFD39A",
    "ok-soft": "#173C33", "ok-ink": "#97E6C4",
    "sky-soft": "#1C3253", "sky-ink": "#B0D7FF",
}
# Non-colour tokens per mode (not swatches).
EXTRA_LIGHT = {"shadow": "0 1px 2px rgba(35,38,98,.05),0 12px 32px -10px rgba(35,38,98,.16)",
               "shadow-sm": "0 1px 2px rgba(35,38,98,.06),0 4px 12px -4px rgba(35,38,98,.10)", "panel-edge": "transparent"}
EXTRA_DARK = {"shadow": "0 12px 32px -12px rgba(0,0,0,.55)", "shadow-sm": "0 4px 12px -6px rgba(0,0,0,.5)",
              "panel-edge": "#2F3256"}

# Every pair where text sits in the mockups (>= 4.5:1).
TEXT_PAIRS = [
    ("ink", "ground"), ("ink", "panel"), ("ink", "well"), ("ink", "selected"),
    ("ink2", "ground"), ("ink2", "panel"), ("ink2", "well"), ("ink2", "selected"),
    ("primary", "panel"), ("on-primary", "primary"), ("primary-ink", "primary-soft"), ("primary-ink", "panel"),
    ("on-danger", "danger"), ("danger-ink", "danger-soft"), ("danger-ink", "panel"),
    ("warn-ink", "warn-soft"), ("ok-ink", "ok-soft"), ("sky-ink", "sky-soft"),
    ("ink", "primary-soft"), ("ink", "danger-soft"), ("ink", "warn-soft"), ("ink", "ok-soft"), ("ink", "sky-soft"),
]
# Non-text parts: the primary button against the panel and canvas, radio rings, the blocking badge, check glyphs.
UI_PAIRS = [("primary", "panel"), ("primary", "ground"), ("ink2", "panel"), ("danger", "panel"), ("ok-ink", "panel")]


def lum(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def css_vars(pal, extra):
    return ";".join(f"--{k}:{v}" for k, v in {**pal, **extra}.items())


# ---------------------------------------------------------------- icons (stroke = currentColor)
def ico(path, size=16, sw=1.8):
    return (f"<svg class='i' width='{size}' height='{size}' viewBox='0 0 24 24' fill='none' stroke='currentColor' "
            f"stroke-width='{sw}' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>{path}</svg>")


I_HOME = "<path d='M4 11l8-6.5 8 6.5'/><path d='M6 10v9.5h12V10'/>"
I_GRID = ("<rect x='4' y='4' width='7' height='7' rx='2.2'/><rect x='13' y='4' width='7' height='7' rx='2.2'/>"
          "<rect x='4' y='13' width='7' height='7' rx='2.2'/><rect x='13' y='13' width='7' height='7' rx='2.2'/>")
I_DOC = "<path d='M7 3.5h7l4 4v13H7z'/><path d='M14 3.5v4h4M10 12h5M10 15.5h5'/>"
I_UPLOAD = "<path d='M12 15V5M8 9l4-4 4 4'/><path d='M5 15v4h14v-4'/>"
I_APPROVE = "<rect x='4' y='4' width='16' height='16' rx='5.5'/><path d='M8.5 12.2l2.4 2.4 4.8-5'/>"
I_GEAR = ("<circle cx='12' cy='12' r='3'/><path d='M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8"
          "M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8'/>")
I_BELL = "<path d='M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z'/><path d='M10 20.5a2 2 0 0 0 4 0'/>"
I_SEARCH = "<circle cx='11' cy='11' r='6.5'/><path d='M16 16l4 4'/>"
I_SHEET = "<rect x='4.5' y='3.5' width='15' height='17' rx='3'/><path d='M4.5 9h15M4.5 14.5h15M10 3.5v17'/>"
I_CHECK = "<path d='M5 12.5l4.5 4.5L19 7.5'/>"
I_LOCK = "<rect x='5.5' y='10.5' width='13' height='9' rx='2.5'/><path d='M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5'/>"
I_ARROW = "<path d='M5 12h14M13 6l6 6-6 6'/>"
I_CHEV = "<path d='M9 6l6 6-6 6'/>"
I_QUOTE = ("<path d='M9.5 7.5H6.8A1.8 1.8 0 0 0 5 9.3v2.4c0 1 .8 1.8 1.8 1.8H9v.6c0 1.4-.9 2.6-2.3 3'/>"
           "<path d='M18.5 7.5h-2.7a1.8 1.8 0 0 0-1.8 1.8v2.4c0 1 .8 1.8 1.8 1.8H18v.6c0 1.4-.9 2.6-2.3 3'/>")
I_LINK = ("<path d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'/>"
          "<path d='M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'/>")
I_COMMENT = "<path d='M5 5.5h14v10h-9l-4 3.5v-3.5H5z'/>"
I_SHIELD = "<path d='M12 3.5l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9v-5z'/><path d='M9 12l2 2 4-4'/>"
I_RETRY = "<path d='M4.5 12a7.5 7.5 0 1 0 2.2-5.3'/><path d='M4.5 4.5v4h4'/>"
I_PIN = "<path d='M12 3.5v3M8.5 6.5h7l-.8 5 2.8 2.5H6.5l2.8-2.5z'/><path d='M12 14v6.5'/>"
I_FLAG = "<path d='M6 21V4M6 4.5h11l-2 4 2 4H6'/>"
I_CLOCK = "<circle cx='12' cy='12' r='8.5'/><path d='M12 7.5V12l3 2'/>"
I_WAIT = "<circle cx='12' cy='12' r='8.5'/><path d='M8 12h.01M12 12h.01M16 12h.01' stroke-width='2.6'/>"

# Status glyphs: shape carries the state as well as colour (16-unit box, drawn in currentColor).
def glyph(kind, size=13):
    shapes = {
        "block": "<circle cx='8' cy='8' r='6.2'/><path d='M8 4.9v3.6M8 10.9v.2' stroke-width='1.9'/>",
        "warn": "<path d='M8 2.2l6.3 11.3H1.7z'/><path d='M8 6.4v3M8 11.4v.2' stroke-width='1.9'/>",
        "ok": "<circle cx='8' cy='8' r='6.2'/><path d='M5.2 8.2l1.9 1.9 3.8-4' stroke-width='1.8'/>",
        "review": "<circle cx='8' cy='8' r='6.2'/><path d='M8 1.8a6.2 6.2 0 0 1 0 12.4z' fill='currentColor' stroke='none'/>",
        "submitted": "<circle cx='8' cy='8' r='6.2'/><path d='M8 11.2V5.2M5.6 7.4L8 5l2.4 2.4' stroke-width='1.7'/>",
        "draft": "<circle cx='8' cy='8' r='6.2' stroke-dasharray='2.4 2.1'/>",
        "failed": "<circle cx='8' cy='8' r='6.2'/><path d='M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2' stroke-width='1.7'/>",
    }
    return (f"<svg class='g' width='{size}' height='{size}' viewBox='0 0 16 16' fill='none' stroke='currentColor' "
            f"stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>{shapes[kind]}</svg>")


def pill(kind, text, tone=None):
    tone = tone or {"block": "danger", "warn": "warn", "ok": "ok", "review": "primary", "submitted": "sky",
                    "draft": "neutral", "failed": "warn"}[kind]
    return f"<span class='pill {tone}'>{glyph(kind)}{text}</span>"


def av(initials, tone):
    return f"<span class='av {tone}' aria-hidden='true'>{initials}</span>"


def code(s):
    return f"<code class='cc'>{s}</code>"


LOGO = ("<span class='logo' aria-hidden='true'><svg width='22' height='22' viewBox='0 0 24 24' fill='none'>"
        "<rect x='3' y='3' width='8' height='8' rx='4' fill='currentColor'/><rect x='13' y='3' width='8' height='8' rx='2.5' "
        "fill='currentColor' opacity='.55'/><rect x='3' y='13' width='8' height='8' rx='2.5' fill='currentColor' opacity='.55'/>"
        "<rect x='13' y='13' width='8' height='8' rx='4' fill='currentColor'/></svg></span>")


def rail(active):
    items = [("home", I_HOME), ("board", I_GRID), ("upload", I_UPLOAD), ("doc", I_DOC), ("approve", I_APPROVE)]
    btns = "".join(f"<span class='rb{' on' if k == active else ''}'>{ico(p, 19)}</span>" for k, p in items)
    return (f"<nav class='rail'>{LOGO}<div class='rbs'>{btns}</div><div class='rfoot'><span class='rb'>{ico(I_GEAR, 19)}</span>"
            f"{av('MO', 'peach')}</div></nav>")


# ---------------------------------------------------------------- M1 · SCR-4 Validation report (FLOW-3)
def err_item(title, body, prop):
    return (f"<div class='item'><div class='itop'>{pill('block', 'Error')}<b>{title}</b></div><p>{body}</p>"
            f"<div class='fix'><span class='prop'>{ico(I_ARROW, 14)}<span>{prop}</span></span><span class='acts'>"
            f"<span class='btn pri sm'>Confirm</span><span class='btn soft sm'>Edit</span></span></div></div>")


def warn_item(title, quote, opts, default_only=False):
    chips = "".join(f"<span class='opt{' on' if i == 0 else ''}'>{ico(I_CHECK, 13, 2.2) if i == 0 else ''}{o}</span>"
                    for i, o in enumerate(opts))
    lead = "<span class='dl'>Default</span>" if default_only else ""
    return (f"<div class='item'><div class='itop'>{pill('warn', 'Warning')}<b>{title}</b></div>"
            f"<p class='q'>{quote}</p><div class='opts'>{lead}{chips}</div></div>")


M1 = f"""<div class="frame m1">{rail('upload')}<div class="work">
<div class="m1top">
 <header class="card head">
  <p class="crumb">Grade 6 · Unit 4 · <i>The Lightning Thief</i></p>
  <h3>Outline v1</h3>
  <div class="meta"><span class="chip">{ico(I_SHEET, 14)}<code>g6-u4-outline.xlsx</code></span><span class="by">{av('AC', 'lilac')}uploaded by A. Chen</span></div>
 </header>
 <div class="tiles">
  <div class="tile lilac"><b class="num">47</b><span>teaching days</span></div>
  <div class="tile rose"><b class="num">5</b><span>{glyph('block')}errors to confirm</span></div>
  <div class="tile peach"><b class="num">7</b><span>{glyph('warn')}ELD labels flagged</span></div>
  <div class="tile sky"><b class="num">2</b><span>bad filenames</span></div>
 </div>
</div>
<div class="m1cols">
 <div class="m1left">
 <section class="card list errs">
  <div class="ph"><h4>Errors</h4><span class="count rose">5 errors to confirm</span></div>
  {err_item('Unit', 'The sheet says <b>G6, U4</b>; every filename says <b>U3</b>.', 'Confirm <b>U4</b>')}
  {err_item('Row 8 · Lesson 4 · Focus', f'{code("RL.6.1, 6.2 L.6.4")} — “6.2” has no strand.', f'Proposed: {code("RL.6.1 · RL.6.2 · L.6.4")}')}
  {err_item('Rows 30, 34, 39', f'{code("RL.6.9.a")} does not exist.', f'Drop it ({code("RL.6.9")} is already listed)')}
  <div class="okrow">{pill('ok', 'OK')}<b>Row 10 · Lesson 6</b><span>0 warnings</span></div>
 </section>
 <section class="card gen"><span class="btn dis">{ico(I_LOCK, 15)}Generate 47 lessons</span><span class="genwhy">{glyph('block')}Generate stays off: 5 errors to confirm</span></section>
 </div>
 <section class="card list">
  <div class="ph"><h4>Warnings</h4><span class="count peach">each shows its default</span></div>
  {warn_item('Row 8 · Note in <i>Foundational Skills</i>', '“Instead, think about using morphology…”', ['Apply', 'Show to reviewer only', 'Ignore'])}
  {warn_item('Row 9 · <i>Text Set Choice</i>', '“WRITER MUST SLECT AND WRITE TO AN EXCERPT OF THE TEXT”', ['becomes an <b>excerpt slot</b>'], True)}
  {warn_item('Row 9 · <i>Vocabulary</i>', '“Cap at 6 words per lesson”', ['<b>unit rule</b> for rows 8–23'], True)}
  {warn_item(f'Row 8 · {code("ELD.PII.6.5")}', 'Sheet says “Use transitions to connect ideas”; official strand is <i>Modifying to add details</i>', ['Keep', f'Re-map to {code("PII.6.2b")}'])}
  {warn_item('Row 39 · <i>Homework</i>', '“Warn students about potentially triggering scene in tonight’s reading (references to domestic abuse)”', [f'{ico(I_FLAG, 13)}Confirm as a safety flag'], True)}
 </section>
</div>
</div></div>"""

# ---------------------------------------------------------------- M2 · SCR-8 Unit board (FLOW-6)
def board_row(title, typ, state, blocking, advisory, reviewer, note, sel=False):
    kinds = {"In review": "review", "Submitted": "submitted", "Draft": "draft", "Failed": "failed", "Approved": "ok"}
    counts = ""
    if blocking != "—":
        b = f"<span class='n{' blk' if blocking != '0' else ''}'>{glyph('block', 12) if blocking != '0' else ''}{blocking} blocking</span>"
        counts = f"{b}<span class='n'>{advisory} advisory</span>"
    who = (f"<span class='who'>{av(''.join(w[0] for w in reviewer.replace('.', '').split()), 'peach' if reviewer.startswith('M') else 'sky')}{reviewer}</span>"
           if reviewer != "—" else "<span class='who none'>No reviewer yet</span>")
    if note == "Truncated · Retry":
        note_html = f"<p class='bnote'>Truncated · <span class='btn soft xs'>{ico(I_RETRY, 12)}Retry</span></p>"
    elif note == "—":
        note_html = ""
    else:
        note_html = f"<p class='bnote'>{note}</p>"
    return (f"<div class='brow{' sel' if sel else ''}'><div class='r1'><b>{title}</b>{pill(kinds[state], state)}</div>"
            f"<div class='r2'><span class='type'>{typ}</span>{counts}{who}</div>{note_html}</div>")


M2_ROWS = "".join([
    board_row("Lesson 4: The Lightning Thief, Chapter 1", "Reading", "In review", "3", "1", "M. Okafor", "Waits on Lesson 5’s excerpt", True),
    board_row("Lesson 5: Comparing Percy and Soongoora", "Writing", "Submitted", "0", "2", "J. Rivera", "—"),
    board_row("Lesson 31: Comparing the Gods’ Home", "Writing", "Draft", "2", "2", "—", f"{glyph('block', 12)}Safety flag open"),
    board_row("Flex Day: Meaning-Making Huddle", "Flex Day", "Draft", "1", "1", "—", f"Standard proposed: {code('RL.6.7')}"),
    board_row("Lesson 22", "Reading", "Failed", "—", "—", "—", "Truncated · Retry"),
    board_row("Lesson 6", "Reading", "Approved", "0", "0", "J. Rivera", "Approved · v2"),
])

M2 = f"""<div class="frame m2">{rail('board')}<div class="work">
<header class="greet"><div><h3>Good morning, M. Okafor</h3><p>Unit 4 · <i>The Lightning Thief</i> · 47 lessons</p></div>
 <div class="gr"><span class="ib">{ico(I_SEARCH, 17)}</span><span class="ib">{ico(I_BELL, 17)}</span>{av('MO', 'peach')}</div></header>
<div class="m2cols">
 <section class="card p1">
  <p class="eyebrow">Roll-up</p>
  <div class="mt">
   <div class="tile neutral sm"><span>{glyph('draft')}Draft</span><b class="num">34</b></div>
   <div class="tile lilac sm"><span>{glyph('review')}In review</span><b class="num">6</b></div>
   <div class="tile sky sm"><span>{glyph('submitted')}Submitted</span><b class="num">2</b></div>
   <div class="tile mint sm"><span>{glyph('ok')}Approved</span><b class="num">3</b></div>
   <div class="tile peach sm wide"><span>{glyph('failed')}Failed</span><b class="num">2</b></div>
  </div>
  <div class="ns">
   <p class="eyebrow">North star</p>
   <h5>Reviewer minutes per approved lesson</h5>
   <div class="nsv"><b class="num">24</b><span>min median</span><span class="nn"><i>n</i> = 3</span></div>
   <div class="nsg"><div><span>fast approvals</span><b class="num">0 of 3</b></div><div><span>approved</span><b class="num">3 of 47</b></div></div>
   <p class="cap">No baseline yet (AQ-14). Measured with us as reviewers.</p>
  </div>
 </section>
 <section class="card p2">
  <div class="chips"><span class="fc on">All</span><span class="fc">Draft</span><span class="fc">In review</span><span class="fc">Submitted</span><span class="fc">Approved</span><span class="fc">Failed</span></div>
  <p class="sort">Sorted by blocking issues</p>
  <div class="rows">{M2_ROWS}</div>
 </section>
 <section class="card p3">
  <div class="thumb" aria-hidden="true"><span class="tl w60"></span><span class="tl w90"></span><span class="tl w80"></span><span class="tblk"></span><span class="tl w70"></span><span class="tl w85"></span></div>
  <h4>Lesson 4: The Lightning Thief, Chapter 1</h4>
  <div class="pp">{pill('review', 'In review')}<span class="pill neutral">Reading</span></div>
  <dl class="kv">
   <div><dt>Blocking</dt><dd class="blk">{glyph('block', 12)}3</dd></div>
   <div><dt>Advisory</dt><dd>1</dd></div>
   <div><dt>Reviewer</dt><dd>{av('MO', 'peach')}M. Okafor</dd></div>
  </dl>
  <div class="waitnote">{ico(I_WAIT, 16)}Waits on Lesson 5’s excerpt</div>
  <span class="btn pri lg open">Open lesson{ico(I_ARROW, 15)}</span>
 </section>
</div></div></div>"""

# ---------------------------------------------------------------- M3 · SCR-9 Lesson workspace, Lesson 4 (FLOW-7, WP-1)
STEPS = ["Draft", "In review", "Submitted", "Approved", "Exported"]
STEPPER = "".join(
    (f"<span class='st done'>{ico(I_CHECK, 12, 2.4)}{s}</span>" if i == 0 else
     f"<span class='st now'>{glyph('review', 12)}{s}</span>" if i == 1 else f"<span class='st'>{s}</span>")
    + (f"<span class='sa'>{ico(I_CHEV, 12)}</span>" if i < len(STEPS) - 1 else "")
    for i, s in enumerate(STEPS))


def issue(kind, text, num):
    lab = "Blocking" if kind == "block" else "Advisory"
    return (f"<div class='iss {kind}'><span class='inum'>{num}</span><p>{pill(kind, lab)} {text}</p></div>")


def std(code_s, src, taught, checked, confirm=False):
    src_html = f"<span class='pill warn'>{glyph('warn')}{src}</span>" if confirm else f"<span class='src'>{src}</span>"
    return (f"<div class='std'><div class='s1'>{code(code_s)}{src_html}</div>"
            f"<div class='s2'><span>taught: <b>{taught}</b></span><span>checked: <b>{checked}</b></span></div></div>")


def m3(cls=""):
    return f"""<div class="frame m3 {cls}">{rail('doc')}<div class="work">
<div class="m3cols">
 <aside class="card outline">
  <p class="eyebrow">Sections</p>
  <ul>
   <li><span>Launch</span><b class="num">5</b></li>
   <li class="on"><span>Literacy Lab</span><b class="num">10</b></li>
   <li><span>Learning in Action</span><b class="num">30</b></li>
   <li class="sub"><span>Part A</span><b class="num">15</b></li>
   <li class="sub"><span>Part B {av('MO', 'peach')}</span><b class="num">15</b></li>
   <li><span>Look Back</span><b class="num">5</b></li>
   <li><span>Homework</span><b></b></li>
  </ul>
  <p class="unit">minutes</p>
 </aside>
 <section class="card editor">
  <div class="eh">
   <h3>Lesson 4: The Lightning Thief, Chapter 1</h3>
   <div class="em"><span class="pill neutral">Reading</span><span class="pill neutral">{ico(I_CLOCK, 12)}50 min</span>{pill('review', 'In review')}<span class="pill neutral">v3</span>
    <span class="presence">{av('MO', 'peach')}<span class="dot"></span>M. Okafor is editing Part B</span></div>
  </div>
  <div class="stepper">{STEPPER}</div>
  <div class="doc">
   <p class="sec">Literacy Lab · 10 min</p>
   <h4 class="routine">Introduce New Words Using <span class="selx">Morphemes<span class="fbar" aria-hidden="true"><b>B</b><i>I</i><s>S</s>{ico(I_LINK, 14)}<span class="fsep"></span>{ico(I_COMMENT, 14)}</span></span></h4>
   <div class="say"><span class="tag">Say</span><p>“Today we’ll use word parts to unlock new words. The root <i>mort-</i> means death.”</p></div>
   <div class="say"><span class="tag">Ask</span><p>“If <i>mort</i> means death, what does <i>immortal</i> mean?”</p></div>
   <div class="sample"><span>Sample response</span>“Not able to die. <i>Im-</i> means not.”</div>
   <p class="sec">Learning in Action · Part A: Percy’s Voice (<code>RL.6.1</code>, <code>RL.6.4</code>) · 15 min</p>
   <div class="ph-block"><span class="inum">1</span><span class="qi">{ico(I_QUOTE, 18)}</span>
    <div><p>Reviewer to insert: one sentence from Ch. 1, pp. 1–8, where Percy’s sarcastic word choice sets the tone</p>
     <div class="pbm"><span class="pill neutral">rights: <i>short-quote-commentary</i></span><span class="btn pri sm">Insert quote</span></div></div></div>
  </div>
  <footer class="ef"><span class="btn dis">{ico(I_LOCK, 15)}Submit for approval</span>{pill('block', '3 blocking issues')}
   <p>Active review time on this lesson is recorded and shown only as unit totals.</p></footer>
 </section>
 <aside class="card evidence">
  <div class="evh"><h4>Issues</h4><span class="sub">3 blocking, 1 advisory</span></div>
  {issue('block', f"Quote placeholder open · {code('G6.U4.L4.LearningInAction.PartA')}", 1)}
  {issue('block', "Homework waits on Lesson 5’s excerpt", 2)}
  {issue('block', f"{code('L.6.4.b')} was chosen by the tool — confirm or remove", 3)}
  {issue('warn', f"{code('ELD.PII.6.5')} label names another strand", 4)}
  <div class="evh st2"><h4>Standards</h4></div>
  {std('RL.6.1', 'from the outline', 'Part A', 'Look Back')}
  {std('RL.6.2', 'outline, fixed by A. Chen', 'Part B', 'Pulse Check')}
  {std('L.6.4.b', 'chosen by the tool · confirm', 'Literacy Lab', 'Literacy Lab check', True)}
  <blockquote class="official"><span>Official text of {code('L.6.4.b')}</span>“Use common, grade-appropriate Greek or Latin affixes and roots as clues to the meaning of a word (e.g., audience, auditory, audible).”</blockquote>
 </aside>
</div></div></div>"""


# ---------------------------------------------------------------- M4 · SCR-14 Approval review, Lesson 5 (FLOW-12, WP-2)
def check(title, evidence):
    ev = f"<p>{evidence}</p>" if evidence else ""
    return (f"<div class='ck'><span class='cki'>{ico(I_CHECK, 14, 2.4)}</span><div><b>{title}</b>{ev}</div>"
            f"{pill('ok', 'Checked')}</div>")


M4 = f"""<div class="frame m4">{rail('approve')}<div class="work">
<header class="card head4">
 <div><h3>Lesson 5: Comparing Percy and Soongoora</h3>
  <div class="em"><span class="pill neutral">Writing</span>{pill('submitted', 'Submitted')}<span class="by">by {av('JR', 'sky')}J. Rivera</span></div></div>
 <span class="snap">{ico(I_PIN, 14)}snapshot <code>9f3c…a21e</code></span>
</header>
<div class="banner">{ico(I_LINK, 16)}Lesson 4 is waiting on this lesson’s excerpt.</div>
<div class="m4cols">
 <section class="card checklist">
  <div class="ph"><h4>Approval checklist</h4><span class="count lilac">5 of 5 checked</span></div>
  {check('Quotes and excerpts', 'Excerpt inserted by J. Rivera from <i>Zanzibar Tales</i> (Bateman trans.) · rights: public-domain · source recorded')}
  {check('Standards taught and checked', f"{code('W.6.2.a')} {code('W.6.2.b')} {code('W.6.2.f')} confirmed by J. Rivera")}
  {check('ELD supports keep the same text and task', '')}
  {check('Social content reviewed', '')}
  {check('AI-assisted spans', '1 accepted by J. Rivera')}
 </section>
 <section class="card decide">
  <div class="eyes">{ico(I_SHIELD, 20)}<p><b>Four eyes</b>You did not edit this lesson, so you can approve it.</p></div>
  <p class="lbl">Draft quality <span>(required)</span></p>
  <div class="radios">
   <span class="rd"><em></em>Usable as drafted</span>
   <span class="rd on"><em></em>Usable with edits</span>
   <span class="rd"><em></em>Rewritten</span>
  </div>
  <div class="actions"><span class="btn pri lg">{ico(I_CHECK, 16, 2.2)}Approve this version</span>
  <span class="btn soft lg">Request changes</span>
  <p class="small">Approving pins snapshot 9f3c…a21e. If it changes before you approve, you’ll be asked to reload.</p></div>
 </section>
</div></div></div>"""

# ---------------------------------------------------------------- CSS
FONT = "ui-rounded,'SF Pro Rounded','Nunito',system-ui,sans-serif"
# Bold display text only: Chrome exposes no rounded system face, so Arial Rounded MT Bold (bold-only, ships with macOS)
# stands in after the true rounded faces; Safari uses ui-rounded first.
DISPLAY = "ui-rounded,'SF Pro Rounded','Nunito','Arial Rounded MT Bold',system-ui,sans-serif"
MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace"

CSS = """
:root{color-scheme:light dark;--pg-bg:#F7F7FC;--pg-card:#FFFFFF;--pg-ink:#1C1D35;--pg-ink2:#535675;--pg-hair:#E3E5F4;--pg-link:#4B48D6;--pg-chip:#ECEBFE}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--pg-bg:#101122;--pg-card:#1D1F38;--pg-ink:#EEEEFB;--pg-ink2:#B4B6D6;--pg-hair:#2F3256;--pg-link:#A5A8FF;--pg-chip:#2E3068}}
:root[data-theme="dark"]{--pg-bg:#101122;--pg-card:#1D1F38;--pg-ink:#EEEEFB;--pg-ink2:#B4B6D6;--pg-hair:#2F3256;--pg-link:#A5A8FF;--pg-chip:#2E3068}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--pg-bg);color:var(--pg-ink);font:15px/1.55 FONT;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.page{max-width:1272px;margin:0 auto;padding:28px 16px 72px;min-width:0}
h1,h2,h3,h4,h5{text-wrap:balance;margin:0}
h1,h2,.frame h3,.tile b,.nsv b{font-family:DISPLAYF;font-weight:700;letter-spacing:-.005em}
p{text-wrap:pretty}
code{font-family:MONO;font-size:.88em}
.num{font-variant-numeric:tabular-nums}
.i,.g{flex:none;display:inline-block;vertical-align:-2px}
/* ---------- sheet chrome ---------- */
.badges{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.badge{display:inline-flex;align-items:center;gap:6px;background:var(--pg-chip);color:var(--pg-ink);border-radius:999px;padding:4px 12px;font-size:13px;font-weight:600}
.badge.plain{background:var(--pg-card);box-shadow:0 0 0 1px var(--pg-hair);font-weight:500}
h1{font-size:34px;line-height:1.15;font-weight:700;letter-spacing:-.015em}
h1 small{display:block;font-size:15px;font-weight:600;color:var(--pg-ink2);letter-spacing:0;margin-bottom:4px}
.lede{font-size:18px;color:var(--pg-ink);margin:10px 0 6px;max-width:68ch}
.lede2{color:var(--pg-ink2);margin:0;max-width:78ch}
.glance{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:22px 0 0}
.glance div{background:var(--pg-card);border-radius:16px;padding:12px 14px;box-shadow:0 0 0 1px var(--pg-hair)}
.glance dt{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--pg-ink2)}
.glance dd{margin:2px 0 0;font-size:14px}
section.s{margin:44px 0 0}
section.s>h2{font-size:22px;font-weight:700;letter-spacing:-.01em}
.note{color:var(--pg-ink2);margin:4px 0 16px;max-width:82ch}
.mh{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin:26px 0 10px}
.mh b{font-size:16px}.mh span{color:var(--pg-ink2);font-size:14px}
.scroll{overflow-x:auto;border-radius:26px;-webkit-overflow-scrolling:touch;max-width:100%}
.palettes{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.pal{border-radius:22px;padding:18px}
.pal h3{font-size:17px;margin:0 0 12px}
.sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px}
.sw{font-size:12px;display:flex;flex-direction:column;gap:1px;min-width:0}
.sw span{height:40px;border-radius:12px;box-shadow:inset 0 0 0 1px rgba(127,127,160,.28)}
.sw b{font-weight:600;margin-top:4px;overflow-wrap:anywhere}.sw code{opacity:.85;font-size:11px}
.ct{border-collapse:collapse;width:100%;font-size:13px;margin-top:16px}
.ct th{text-align:left;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;padding:4px 6px;opacity:.8}
.ct td{padding:4px 6px;border-top:1px solid rgba(127,127,160,.25)}
.ct td:nth-child(2){font-variant-numeric:tabular-nums;white-space:nowrap}
.ct tr.ui td:first-child::after{content:' (UI part, 3:1)';opacity:.7}
.lowest{margin:10px 0 0;font-size:13px;font-weight:600}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:18px}
.shot{margin:0;background:var(--pg-card);border-radius:20px;overflow:hidden;box-shadow:0 0 0 1px var(--pg-hair)}
.shot img{width:100%;height:auto;display:block;aspect-ratio:4/3;object-fit:cover}
.shot figcaption{padding:12px 14px 14px;font-size:13.5px}
.shot .t{font-weight:700;font-size:14.5px;display:block}.shot .d{color:var(--pg-ink2)}
.shot .why{margin:6px 0 4px}.shot .feel{display:inline-block;background:var(--pg-chip);border-radius:999px;padding:1px 9px;font-size:12px;font-weight:600}
.shot .ir{display:inline-block;margin-left:6px;font-size:12px;color:var(--pg-ink2)}
.shot a{display:block;margin-top:6px;color:var(--pg-link);word-break:break-all;font-size:12px}
.foot-note{margin:48px 0 0;color:var(--pg-ink2);font-size:14px}
.checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:6px}
.checks div{background:var(--pg-card);border-radius:16px;padding:10px 14px;box-shadow:0 0 0 1px var(--pg-hair);font-size:14px}
.checks b{display:block}

/* ---------- mockup system (colours only from palette vars) ---------- */
.frame{width:1200px;min-height:760px;background:var(--ground);color:var(--ink);font:13.5px/1.45 FONT;display:grid;grid-template-columns:68px 1fr;gap:14px;padding:14px;border-radius:26px;position:relative}
.frame .work{display:flex;flex-direction:column;gap:14px;min-width:0}
.card{background:var(--panel);border-radius:20px;box-shadow:var(--shadow),0 0 0 1px var(--panel-edge)}
.frame h3{font-size:21px;font-weight:700;letter-spacing:-.01em;line-height:1.25}
.frame h4{font-size:15.5px;font-weight:700}
.frame h5{font-size:14px;font-weight:700}
.frame p{margin:0}
.frame code{font-family:MONO}
.cc{background:var(--well);color:var(--ink);border-radius:8px;padding:1px 6px;font-size:12px;white-space:nowrap;box-shadow:inset 0 0 0 1px var(--hair)}
.eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--ink2)}
/* rail */
.rail{background:var(--panel);border-radius:22px;box-shadow:var(--shadow),0 0 0 1px var(--panel-edge);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:18px}
.logo{width:40px;height:40px;border-radius:14px;background:var(--primary);color:var(--on-primary);display:inline-flex;align-items:center;justify-content:center}
.rbs{display:flex;flex-direction:column;gap:8px}
.rb{width:42px;height:42px;border-radius:15px;display:inline-flex;align-items:center;justify-content:center;color:var(--ink2)}
.rb.on{background:var(--primary-soft);color:var(--primary-ink)}
.rfoot{margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:10px}
/* avatars */
.av{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-size:10px;font-weight:700;flex:none;letter-spacing:.02em;color:var(--ink)}
.av.lilac{background:var(--primary-soft);color:var(--primary-ink)}.av.peach{background:var(--warn-soft);color:var(--warn-ink)}.av.sky{background:var(--sky-soft);color:var(--sky-ink)}
.rail .av{width:34px;height:34px;font-size:12px}
/* pills: always filled, glyph + word */
.pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 10px 3px 8px;font-size:12px;font-weight:650;white-space:nowrap;line-height:1.35}
.pill.danger{background:var(--danger-soft);color:var(--danger-ink)}
.pill.warn{background:var(--warn-soft);color:var(--warn-ink)}
.pill.ok{background:var(--ok-soft);color:var(--ok-ink)}
.pill.primary{background:var(--primary-soft);color:var(--primary-ink)}
.pill.sky{background:var(--sky-soft);color:var(--sky-ink)}
.pill.neutral{background:var(--well);color:var(--ink2);box-shadow:inset 0 0 0 1px var(--hair)}
.count{border-radius:999px;padding:3px 11px;font-size:12px;font-weight:650}
.count.rose{background:var(--danger-soft);color:var(--danger-ink)}.count.peach{background:var(--warn-soft);color:var(--warn-ink)}.count.lilac{background:var(--primary-soft);color:var(--primary-ink)}
/* buttons: solid indigo, soft fills; never gradients */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:999px;font-weight:650;white-space:nowrap}
.btn.pri{background:var(--primary);color:var(--on-primary)}
.btn.soft{background:var(--primary-soft);color:var(--primary-ink)}
.btn.sm{padding:6px 14px;font-size:12.5px}.btn.xs{padding:2px 9px;font-size:11.5px;gap:4px}
.btn.lg{padding:12px 18px;font-size:14.5px;width:100%}
.btn.dis{background:var(--well);color:var(--ink2);padding:10px 18px;font-size:14px;box-shadow:inset 0 0 0 1px var(--hair)}
/* tiles: soft tints */
.tile{border-radius:18px;padding:12px 14px;display:flex;flex-direction:column;justify-content:space-between;color:var(--ink)}
.tile b{font-size:30px;font-weight:700;line-height:1.05;letter-spacing:-.02em}
.tile span{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:5px}
.tile.lilac{background:var(--primary-soft)}.tile.rose{background:var(--danger-soft)}.tile.peach{background:var(--warn-soft)}
.tile.sky{background:var(--sky-soft)}.tile.mint{background:var(--ok-soft)}.tile.neutral{background:var(--well);box-shadow:inset 0 0 0 1px var(--hair)}
.tile.sm{gap:4px;padding:10px 12px;border-radius:15px}.tile.sm b{font-size:22px}
.tile.sm.wide{flex-direction:row;align-items:center}
.tile.wide{grid-column:1/-1}
/* M1 */
.m1top{display:grid;grid-template-columns:1fr 560px;gap:14px}
.head{padding:16px 20px}
.crumb{color:var(--ink2);font-size:13px;font-weight:600}
.head h3{margin:2px 0 8px}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--well);border-radius:999px;padding:4px 11px;color:var(--ink);font-size:12.5px;box-shadow:inset 0 0 0 1px var(--hair)}
.by{display:inline-flex;align-items:center;gap:7px;color:var(--ink2);font-size:13px}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.tiles .tile{padding:14px}
.m1cols{display:grid;grid-template-columns:.88fr 1.12fr;gap:14px;flex:1}
.list{padding:8px 10px 10px}
.ph{display:flex;align-items:center;justify-content:space-between;padding:8px 8px 10px}
.item{background:var(--well);border-radius:16px;padding:10px 12px;margin-bottom:8px}
.itop{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.itop b{font-weight:650;font-size:13px}
.item p{color:var(--ink)}
.item p.q{color:var(--ink);font-size:13px}
.fix{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;flex-wrap:wrap}
.prop{display:inline-flex;align-items:center;gap:6px;color:var(--ink);font-size:13px}.prop .i{color:var(--primary-ink)}
.acts{display:inline-flex;gap:6px}
.opts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:7px}
.opt{display:inline-flex;align-items:center;gap:5px;background:var(--panel);color:var(--ink2);border-radius:999px;padding:4px 11px;font-size:12px;font-weight:600;box-shadow:0 0 0 1px var(--hair)}
.opt.on{background:var(--primary);color:var(--on-primary);box-shadow:none}
.dl{font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink2);margin-right:2px}
.okrow{display:flex;align-items:center;gap:10px;background:var(--ok-soft);border-radius:16px;padding:10px 12px;color:var(--ink)}
.okrow span:last-child{margin-left:auto;color:var(--ink);font-size:12.5px}
.m1left{display:flex;flex-direction:column;gap:14px;min-width:0}
.errs{flex:1;display:flex;flex-direction:column}.errs .okrow{margin-top:auto}
.gen{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:16px 18px}
.genwhy{display:inline-flex;align-items:center;gap:6px;color:var(--danger-ink);font-weight:600}
/* M2 */
.greet{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 0}
.greet h3{font-size:26px}.greet p{color:var(--ink2);font-size:14px;margin-top:2px}
.gr{display:flex;align-items:center;gap:8px}.gr .av{width:36px;height:36px;font-size:12px}
.ib{width:38px;height:38px;border-radius:14px;background:var(--panel);display:inline-flex;align-items:center;justify-content:center;color:var(--ink2);box-shadow:var(--shadow-sm),0 0 0 1px var(--panel-edge)}
.m2cols{display:grid;grid-template-columns:270px 1fr 290px;gap:14px;flex:1}
.p1{padding:16px;display:flex;flex-direction:column;gap:10px}
.mt{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mt .tile{justify-content:space-between}
.ns{background:var(--well);border-radius:18px;padding:14px;margin-top:4px;box-shadow:inset 0 0 0 1px var(--hair)}
.ns h5{margin:4px 0 8px;line-height:1.3}
.nsv{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}.nsv b{font-size:36px;font-weight:700;letter-spacing:-.02em;line-height:1}
.nsv span{color:var(--ink2);font-weight:600}.nsv .nn{margin-left:auto;background:var(--panel);border-radius:999px;padding:1px 9px;color:var(--ink);font-size:12px}
.nsg{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0 8px}
.nsg div{background:var(--panel);border-radius:12px;padding:7px 9px;display:flex;flex-direction:column}.nsg span{font-size:11.5px;color:var(--ink2);font-weight:600}.nsg b{font-size:15px}
.ns .cap{font-size:12px;color:var(--ink2)}
.p2{padding:14px 12px 12px}
.chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 4px}
.fc{background:var(--well);color:var(--ink2);border-radius:999px;padding:5px 13px;font-size:12.5px;font-weight:600;box-shadow:inset 0 0 0 1px var(--hair)}
.fc.on{background:var(--primary);color:var(--on-primary);box-shadow:none}
.sort{font-size:12px;color:var(--ink2);font-weight:600;padding:10px 6px 6px}
.rows{display:flex;flex-direction:column;gap:6px}
.brow{border-radius:16px;padding:10px 12px}
.brow:not(.sel){box-shadow:inset 0 -1px 0 var(--hair);border-radius:0}
.brow.sel{background:var(--selected)}
.r1{display:flex;align-items:center;justify-content:space-between;gap:10px}.r1 b{font-weight:650;font-size:14px}
.r2{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;margin-top:4px;color:var(--ink2);font-size:12.5px}
.r2 .type{font-weight:600;color:var(--ink)}
.n{display:inline-flex;align-items:center;gap:4px}.n.blk{color:var(--danger-ink);font-weight:650}
.who{display:inline-flex;align-items:center;gap:6px;margin-left:auto;color:var(--ink)}.who .av{width:20px;height:20px;font-size:9px}
.who.none{color:var(--ink2)}
.bnote{font-size:12.5px;color:var(--ink2);margin-top:3px!important;display:flex;align-items:center;gap:6px}
.p3{padding:14px;display:flex;flex-direction:column;gap:12px}
.thumb{background:var(--well);border-radius:16px;padding:20px 18px;min-height:150px;display:flex;flex-direction:column;gap:7px;box-shadow:inset 0 0 0 1px var(--hair)}
.tl{height:7px;border-radius:99px;background:var(--hair)}.tl.w60{width:60%;background:var(--primary-soft);height:9px}.w90{width:90%}.w80{width:80%}.w70{width:70%}.w85{width:85%}
.tblk{height:30px;border-radius:10px;background:var(--danger-soft)}
.p3 h4{line-height:1.3}
.p3 .open{margin-top:auto}
.pp{display:flex;gap:6px;flex-wrap:wrap}
.kv{margin:0;display:flex;flex-direction:column;gap:2px}
.kv div{display:flex;justify-content:space-between;align-items:center;padding:7px 2px;box-shadow:inset 0 -1px 0 var(--hair)}
.kv dt{color:var(--ink2);font-weight:600;font-size:12.5px}.kv dd{margin:0;display:inline-flex;align-items:center;gap:6px;font-weight:650}
.kv dd.blk{color:var(--danger-ink)}
.waitnote{display:flex;align-items:center;gap:8px;background:var(--sky-soft);color:var(--ink);border-radius:14px;padding:10px 12px;font-weight:600}
.waitnote .i{color:var(--sky-ink)}
/* M3 */
.m3cols{display:grid;grid-template-columns:172px 1fr 304px;gap:14px;flex:1}
.outline{padding:16px 10px}
.outline .eyebrow{padding:0 8px 8px}
.outline ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.outline li{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:13px;font-weight:600;font-size:13px}
.outline li span{display:inline-flex;align-items:center;gap:6px}
.outline li b{font-size:12px;color:var(--ink2);font-weight:600;background:var(--well);border-radius:999px;padding:0 8px;min-width:26px;text-align:center}
.outline li b:empty{display:none}
.outline li.sub{padding-left:24px;font-weight:500;color:var(--ink)}
.outline li.on{background:var(--primary-soft);color:var(--primary-ink)}.outline li.on b{background:var(--panel);color:var(--primary-ink)}
.outline li .av{width:20px;height:20px;font-size:9px}
.outline .unit{font-size:11.5px;color:var(--ink2);padding:10px 10px 0;text-align:right}
.editor{display:flex;flex-direction:column;padding:18px 22px 0;min-width:0}
.eh{display:flex;flex-direction:column;gap:0}
.eh h3{font-size:20px}
.em{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px}
.presence{margin-left:auto;display:inline-flex;align-items:center;gap:7px;background:var(--warn-soft);color:var(--ink);border-radius:999px;padding:4px 12px 4px 4px;font-size:12px;font-weight:600;white-space:nowrap}
.presence .dot{width:7px;height:7px;border-radius:50%;background:var(--warn-ink)}
.stepper{display:flex;align-items:center;justify-content:space-between;gap:2px;margin:14px 0 6px;padding:5px;background:var(--well);border-radius:999px;box-shadow:inset 0 0 0 1px var(--hair)}
.st{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:600;color:var(--ink2)}
.st.done{color:var(--ok-ink);background:var(--ok-soft)}
.st.now{background:var(--primary);color:var(--on-primary)}
.sa{color:var(--ink2);display:inline-flex}
.doc{padding:8px 4px 14px;flex:1;max-width:66ch}
.sec{font-size:12.5px;font-weight:700;color:var(--ink2);margin:16px 0 4px!important}
.sec code{font-size:12px;font-weight:600;color:var(--ink)}
.routine{font-size:18px!important;margin:4px 0 12px!important}
.say{display:flex;gap:10px;align-items:flex-start;margin:0 0 10px;position:relative}
.say p{font-size:14.5px;line-height:1.55}
.tag{flex:none;background:var(--primary-soft);color:var(--primary-ink);border-radius:999px;padding:2px 10px;font-size:11.5px;font-weight:700;margin-top:2px;min-width:44px;text-align:center}
.selx{position:relative;background:var(--primary-soft);border-radius:6px;padding:0 3px;box-shadow:0 0 0 1.5px var(--primary)}
.fbar{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:12px;background:var(--ink);color:var(--panel);border-radius:14px;padding:6px 13px;font-size:13px;font-weight:600;letter-spacing:0;box-shadow:var(--shadow);white-space:nowrap}
.fbar s,.fbar i,.fbar b{font-family:inherit}.fsep{width:1px;height:16px;background:var(--ink2)}
.sample{margin:0 0 6px 54px;background:var(--well);border-radius:14px;padding:9px 12px;font-size:13.5px;color:var(--ink)}
.sample span{display:block;font-size:11.5px;font-weight:700;color:var(--ink2);letter-spacing:.04em;text-transform:uppercase}
.ph-block{display:flex;gap:12px;align-items:flex-start;background:var(--primary-soft);border-radius:18px;padding:14px 14px 14px 12px;margin-top:8px;position:relative}
.ph-block .qi{width:34px;height:34px;border-radius:12px;background:var(--panel);color:var(--primary-ink);display:inline-flex;align-items:center;justify-content:center;flex:none}
.ph-block p{font-size:14px;color:var(--ink);font-weight:500}
.pbm{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;flex-wrap:wrap}
.ph-block .pill.neutral{background:var(--panel)}
.inum{width:20px;height:20px;border-radius:50%;background:var(--danger);color:var(--on-danger);font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex:none}
.ph-block>.inum{position:absolute;top:-8px;right:-8px;box-shadow:0 0 0 3px var(--panel)}
.ef{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 -22px;padding:12px 22px;background:var(--well);border-radius:0 0 20px 20px;box-shadow:inset 0 1px 0 var(--hair)}
.ef p{flex-basis:100%;font-size:12px;color:var(--ink2)}
.evidence{padding:14px 12px;display:flex;flex-direction:column;gap:7px;min-width:0}
.evh{display:flex;align-items:baseline;justify-content:space-between;padding:2px 4px}
.evh .sub{font-size:12px;color:var(--ink2);font-weight:600}
.evh.st2{margin-top:4px}
.iss{display:flex;gap:9px;background:var(--well);border-radius:14px;padding:8px 10px;align-items:flex-start}
.iss.block{background:var(--danger-soft)}.iss.block p{color:var(--ink)}
.iss p{font-size:12.5px;line-height:1.5}
.iss .pill{padding:0 7px 0 5px;font-size:11px;margin-right:2px;vertical-align:1px}
.iss.block .pill{background:var(--panel)}
.iss.warn .inum{background:var(--warn-ink);color:var(--panel)}
.std{background:var(--well);border-radius:14px;padding:8px 10px}
.s1{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap}
.src{font-size:12px;color:var(--ink2);font-weight:600}
.s2{display:flex;gap:2px 10px;flex-wrap:wrap;margin-top:4px;font-size:11.5px;color:var(--ink2)}.s2 b{color:var(--ink);font-weight:600}
.official{margin:2px 0 0;background:var(--panel);border-radius:14px;padding:9px 11px;font-size:12px;line-height:1.45;color:var(--ink);box-shadow:inset 0 0 0 1px var(--hair)}
.official span{display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--ink2);margin-bottom:3px}
/* M4 */
.head4{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 22px}
.head4 .by{margin-left:4px}
.snap{display:inline-flex;align-items:center;gap:6px;background:var(--well);border-radius:999px;padding:6px 14px;font-size:13px;color:var(--ink);font-weight:600;box-shadow:inset 0 0 0 1px var(--hair)}
.snap .i{color:var(--primary-ink)}
.banner{display:flex;align-items:center;gap:10px;background:var(--sky-soft);color:var(--ink);border-radius:18px;padding:12px 18px;font-weight:600;font-size:14px}
.banner .i{color:var(--sky-ink)}
.m4cols{display:grid;grid-template-columns:1fr 380px;gap:14px;flex:1}
.checklist{padding:12px 16px 8px}
.ck{display:grid;grid-template-columns:34px 1fr auto;gap:14px;align-items:start;padding:20px 8px;box-shadow:inset 0 -1px 0 var(--hair)}
.ck:last-child{box-shadow:none}
.cki{width:34px;height:34px;border-radius:50%;background:var(--ok-soft);color:var(--ok-ink);display:inline-flex;align-items:center;justify-content:center}
.ck b{font-weight:650;font-size:14.5px;display:block;margin-top:4px}
.ck p{color:var(--ink2);margin-top:3px!important;font-size:13px;display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.ck .pill{margin-top:4px}
.decide{padding:18px;display:flex;flex-direction:column;gap:10px}
.eyes{display:flex;gap:10px;align-items:flex-start;background:var(--ok-soft);border-radius:16px;padding:14px 16px;color:var(--ink)}
.eyes .i{color:var(--ok-ink);margin-top:1px}
.eyes b{display:block;font-size:13px}
.lbl{font-weight:700;font-size:13.5px;margin-top:6px!important}.lbl span{font-weight:500;color:var(--ink2)}
.radios{display:flex;flex-direction:column;gap:6px}
.rd{display:flex;align-items:center;gap:10px;background:var(--well);border-radius:14px;padding:12px 14px;font-weight:600;color:var(--ink)}
.rd em{width:18px;height:18px;border-radius:50%;box-shadow:inset 0 0 0 2px var(--ink2);flex:none;background:var(--panel)}
.rd.on{background:var(--primary-soft);color:var(--primary-ink)}
.rd.on em{box-shadow:inset 0 0 0 5px var(--primary)}
.actions{margin-top:auto;display:flex;flex-direction:column;gap:10px;padding-top:12px}
.small{font-size:12px;color:var(--ink2)}
/* dark frame: elevation by lighter surface, not shadow */
.frame.dark .card,.frame.dark .rail{box-shadow:0 0 0 1px var(--panel-edge)}
@media (max-width:640px){h1{font-size:28px}.lede{font-size:16px}}
""".replace("DISPLAYF", DISPLAY).replace("FONT", FONT).replace("MONO", MONO)


# ---------------------------------------------------------------- images
def scaled_dir():
    d = os.environ.get("LOOK_SCRATCH")
    if d:
        p = pathlib.Path(d)
        p.mkdir(parents=True, exist_ok=True)
        return p
    return pathlib.Path(tempfile.mkdtemp(prefix="d3look_"))


def data_uri(name, scratch):
    src = REFS / name
    dst = scratch / name
    if shutil.which("sips"):
        subprocess.run(["sips", "--resampleWidth", "900", "-s", "format", "jpeg", "-s", "formatOptions", "80",
                        str(src), "--out", str(dst)], check=True, capture_output=True)
        data = dst.read_bytes()
    else:
        data = src.read_bytes()
    return f"data:image/jpeg;base64,{base64.b64encode(data).decode()}"


def shots_html():
    scratch = scaled_dir()
    out = []
    for f, t, d, u, why, feel in SHOTS:
        out.append(f"<figure class='shot'><img src='{data_uri(f, scratch)}' alt='{t} by {d} (Dribbble shot)' width='900' height='675'>"
                   f"<figcaption><span class='t'>{f[:5]} · {t}</span><span class='d'>{d}</span>"
                   f"<p class='why'>{why}</p><span class='feel'>serves: {feel}</span><span class='ir'>internal reference only</span>"
                   f"<a href='{u}'>{u}</a></figcaption></figure>")
    return "".join(out)


# ---------------------------------------------------------------- palette section
def swatches(pal):
    return "".join(f"<div class='sw'><span style='background:{v}'></span><b>{k}</b><code>{v}</code></div>" for k, v in pal.items())


def verdict(r, need):
    return "pass" if r >= need else "FAIL"


def contrast_table(pal):
    rows = ["<tr><th>Pair</th><th>Ratio</th><th>AA</th></tr>"]
    for fg, bg in TEXT_PAIRS:
        r = ratio(pal[fg], pal[bg])
        rows.append(f"<tr><td>{fg} on {bg}</td><td>{r:.2f}:1</td><td>{verdict(r, 4.5)}</td></tr>")
    for fg, bg in UI_PAIRS:
        r = ratio(pal[fg], pal[bg])
        rows.append(f"<tr class='ui'><td>{fg} edge on {bg}</td><td>{r:.2f}:1</td><td>{verdict(r, 3)}</td></tr>")
    return f"<table class='ct'>{''.join(rows)}</table>"


def lowest(pal):
    r, pair = min((ratio(pal[a], pal[b]), f"{a} on {b}") for a, b in TEXT_PAIRS)
    return r, pair


# ---------------------------------------------------------------- page
def page():
    lt, dk = css_vars(LIGHT, EXTRA_LIGHT), css_vars(DARK, EXTRA_DARK)
    (lr, lp), (dr, dp) = lowest(LIGHT), lowest(DARK)
    m3_light, m3_dark = m3(), m3("dark")
    mocks = [
        ("M1 · Validation report", "SCR-4 · FLOW-3: the outline’s problems shown before money is spent; Generate stays off.", M1, lt),
        ("M2 · Unit board", "SCR-8 · FLOW-6: three panes; roll-up and the north-star tile, rows sorted by blocking issues, the picked lesson.", M2, lt),
        ("M3 · Lesson 4 workspace", "SCR-9 · FLOW-7, WP-1: outline, the lesson as a document, the evidence pane.", m3_light, lt),
        ("M4 · Lesson 5 approval", "SCR-14 · FLOW-12, WP-2: the approval checklist card, four eyes, the decision.", M4, lt),
    ]
    mock_html = "".join(f"<div class='mh'><b>{t}</b><span>{s}</span></div><div class='scroll'><div style='{v}'>{h}</div></div>"
                        for t, s, h, v in mocks)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>D3 Soft Studio look sheet</title><style>{CSS}</style></head>
<body><main class="page">
<div class="badges"><span class="badge">UX-2 · look sheet</span><span class="badge">Status: proposal</span><span class="badge plain">{DATE}</span><span class="badge plain">Newsela Lesson Studio</span></div>
<h1><small>Direction {DIRECTION}</small>{NAME}</h1>
<p class="lede">{INTENT}</p>
<p class="lede2">A static look: four screens drawn in D3’s construction so you can judge its colour and feel in a minute. Nothing is clickable. Linked-screen prototypes come only for the directions you shortlist. Same four screens and the same words on every direction’s sheet (<code>docs/ux/02-concepts/LOOK_SHEET_COPY.md</code>); people’s names and the counts are synthetic. The one line added here is M2’s greeting.</p>
<dl class="glance">
 <div><dt>Softness</dt><dd>Very soft: 16–20 px radius, soft shadows, full pills</dd></div>
 <div><dt>Density</dt><dd>Airy: big cards, open spacing</dd></div>
 <div><dt>Shape</dt><dd>Cards, pills, three panes</dd></div>
 <div><dt>Temperature</dt><dd>Cool pastel periwinkle + indigo</dd></div>
 <div><dt>Type</dt><dd>Rounded sans: the system rounded face in Safari; in Chrome, headings fall back to Arial Rounded and body to the system sans</dd></div>
</dl>

<section class="s"><h2>Mockups, light (the primary theme)</h2>
<p class="note">Desktop frames at 1200 px wide; on a narrow screen each frame scrolls sideways inside its own box. Status always carries a word and a shape (dotted ring = draft, half-filled = in review, arrow = submitted, tick = approved, ! = blocking, triangle = advisory or warning, cross = failed), never colour alone. Red is kept for what blocks Generate, Submit or Approve.</p>
{mock_html}
</section>

<section class="s"><h2>The same workspace, dark</h2>
<p class="note">M3 on the dark twin. Panels step lighter instead of casting shadows; indigo lightens to #A5A8FF with near-black text on it.</p>
<div class="mh"><b>M3 · Lesson 4 workspace (dark)</b><span>Same markup, dark tokens.</span></div>
<div class="scroll"><div style="{dk}">{m3_dark}</div></div>
</section>

<section class="s"><h2>Palette (proposal; UX-3 makes it exact)</h2>
<p class="note">The seven core values per mode are D3’s from <code>DESIGN-DIRECTIONS.md</code>, unchanged; every one passed. Added here at the same hues: <i>selected</i>, <i>hair</i>, and four soft status tints with their inks (danger, warn, ok, sky). Contrast is computed in the generator from these hex values with the WCAG formula; the build exits with an error if a text pair is under 4.5:1 or a UI part under 3:1.</p>
<div class="palettes">
 <div class="pal" style="background:{LIGHT['ground']};color:{LIGHT['ink']}"><h3>Light</h3><div class="sws">{swatches(LIGHT)}</div>{contrast_table(LIGHT)}<p class="lowest">Lowest text pair: {lp} {lr:.2f}:1</p></div>
 <div class="pal" style="background:{DARK['ground']};color:{DARK['ink']}"><h3>Dark</h3><div class="sws">{swatches(DARK)}</div>{contrast_table(DARK)}<p class="lowest">Lowest text pair: {dp} {dr:.2f}:1</p></div>
</div>
</section>

<section class="s"><h2>House-texture check</h2>
<div class="checks">
 <div><b>Cream canvas: no</b>Periwinkle wash #EEF0FB under white panels.</div>
 <div><b>Serif headings: no</b>One rounded sans throughout.</div>
 <div><b>Outlined pills: no</b>Every pill and chip is a filled soft tint.</div>
 <div><b>Sage: no</b>Indigo leads; a clear green appears only for approved and checked.</div>
</div>
</section>

<section class="s"><h2>The six references behind D3</h2>
<p class="note">Other designers’ published Dribbble work, internal reference only; not copied into the product. Credits from <code>docs/design/references/_index.json</code>, reasons from <code>docs/ux/02-concepts/REFERENCES.md</code>.</p>
<div class="shots">{shots_html()}</div>
</section>

<p class="foot-note">Local file, not published. Rebuild: <code>python3 docs/artifacts/_build/d3-look/build_d3_look.py</code></p>
</main></body></html>"""


def check_contrast():
    failures = []
    for mode, pal in (("light", LIGHT), ("dark", DARK)):
        for fg, bg in TEXT_PAIRS:
            r = ratio(pal[fg], pal[bg])
            if r < 4.5:
                failures.append(f"{mode}: {fg} on {bg} {r:.2f}:1 (text needs 4.5)")
        for fg, bg in UI_PAIRS:
            r = ratio(pal[fg], pal[bg])
            if r < 3:
                failures.append(f"{mode}: {fg} edge on {bg} {r:.2f}:1 (UI part needs 3)")
    return failures


if __name__ == "__main__":
    fails = check_contrast()
    if fails:
        print("CONTRAST FAIL\n" + "\n".join(fails))
        sys.exit(1)
    OUT.write_text(page(), encoding="utf-8")
    print(OUT, f"{OUT.stat().st_size / 1e6:.2f} MB")
    for mode, pal in (("light", LIGHT), ("dark", DARK)):
        r, pair = lowest(pal)
        ur, upair = min((ratio(pal[a], pal[b]), f"{a} on {b}") for a, b in UI_PAIRS)
        print(f"{mode}: lowest text pair {pair} = {r:.2f}:1; lowest UI edge {upair} = {ur:.2f}:1")
    sys.exit(0)
