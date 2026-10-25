"""Build the D1 · Clear Ledger look sheet (UX-2, a static look before any prototype).

Copied from ux-pipeline templates/look_sheet_generator.py (2026-10-25) and filled for Newsela Lesson Studio.
Run:      python3 docs/artifacts/_build/d1-look/build_d1_look.py
Writes:   docs/artifacts/2026-10-25-d1-clear-ledger-look-sheet.html (static, offline, images embedded)

Copy:     docs/ux/02-concepts/LOOK_SHEET_COPY.md (M1-M4), the same words on every direction's sheet.
Look:     docs/design/DESIGN-DIRECTIONS.md, D1 column, D1 component anatomy and the D1 palette.
Palette values are a proposal; UX-3 design.md makes them exact. Exit 1 if a text pair is under 4.5:1 or a
UI part under 3:1 (nothing is written in that case).
Images are downscaled to 900 px wide, JPEG quality 80, with macOS `sips` in a temporary folder; without
`sips` the originals (1000 px) are embedded as they are.
"""
import base64
import html
import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
DOCS = HERE.parents[2]  # docs/
REFS = DOCS / "design" / "references"

# ---------------------------------------------------------------- 1. identity
DIRECTION = "D1"
NAME = "Clear Ledger"
INTENT = "The lesson is a document on a desk; the tool is a quiet editor's frame around it."
DATE = "2026-10-25"
OUT = DOCS / "artifacts" / f"{DATE}-d1-clear-ledger-look-sheet.html"

GLANCE = [
    ("Softness", "medium: 8 px radius, hairline borders, one soft page shadow"),
    ("Density", "airy: generous margins, reading width about 70 characters"),
    ("Shape", "page sheet, top stepper, right rail"),
    ("Temperature", "cool neutral white with ink blue"),
    ("Type", "crisp grotesk, large calm headings"),
]

# ---------------------------------------------------------------- 2. references (REFERENCES.md, direction d1)
# (file, title, designer, url, what we take from it, feel-brief line, where it shows up on this sheet)
SHOTS = [
    ("d1-01-ai-contract-management-platform-legal-te.jpg", "AI Contract Management Platform — Legal Tech Dashboard UI",
     "Sunshine", "https://dribbble.com/shots/27786869-AI-Contract-Management-Platform-Legal-Tech-Dashboard-UI",
     "Status stepper with coloured step dots; 'pending' banner with an icon tile", "evidence visible; calm",
     "the stepper on M3 and M4; the banners on M1 and M4"),
    ("d1-02-ai-contract-management-platform-legal-te.jpg", "AI Contract Management Platform — Legal Tech Dashboard UI",
     "Sunshine", "https://dribbble.com/shots/27772256-AI-Contract-Management-Platform-Legal-Tech-Dashboard-UI",
     "Document as a page sheet with thumbnails and a side setup panel", "editorial first",
     "the white page sheet on the grey desk, every screen"),
    ("d1-03-ai-contract-management-platform-legal-te.jpg", "AI Contract Management Platform — Legal Tech Dashboard UI",
     "Sunshine", "https://dribbble.com/shots/27811530-AI-Contract-Management-Platform-Legal-Tech-Dashboard-UI",
     "Approved banner, record fields, quiet rules", "accountable",
     "the light-ruled tables on M1 and M2; the four-eyes notice on M4"),
    ("d1-04-document-editor.jpg", "Document Editor", "Jason Melgoza",
     "https://dribbble.com/shots/21959809-Document-Editor",
     "'Changes and suggestions' rail with ADDED / REMOVED cards and Approve all", "evidence visible",
     "the Issues · Standards rail with tagged cards on M3"),
    ("d1-05-ai-writing-assistant-light.jpg", "AI Writing Assistant - Light", "Dmitry Sergushkin",
     "https://dribbble.com/shots/27449309-AI-Writing-Assistant-Light",
     "AI rewrite card with Replace / Insert and a change toggle", "AI help is one quiet labelled tool",
     "not drawn here: none of the four screens shows an AI assist; it is the model for that card later"),
    ("d1-06-manage.jpg", "Manage", "Never Before Seen",
     "https://dribbble.com/shots/27059959-Manage-comments-in-doc-editor",
     "Long text with a comments rail and an unresolved count", "editorial first",
     "the reading column on M3; comments are not on these four screens"),
]

# ---------------------------------------------------------------- 3. palettes (light is primary)
# Base values from DESIGN-DIRECTIONS.md (ground, panel, well, ink, ink2, primary). The rest are added here.
LIGHT = {
    "ground": "#F4F5F7", "panel": "#FFFFFF", "well": "#F1F3F6", "selected": "#EAF0FE", "hair": "#E2E5EA",
    "ink": "#14171C", "ink2": "#4A5260", "ink3": "#5D6573", "edge": "#858D9B",
    "primary": "#1F4FD8", "on-primary": "#FFFFFF",
    "danger": "#B42318", "danger-tint": "#FDEDEB",
    "warn": "#A4480A", "warn-tint": "#FEF3E4", "on-warn": "#FFFFFF",
    "success": "#17734A", "success-tint": "#E7F5ED", "on-success": "#FFFFFF",
    "disabled": "#E6E9EE",
}
DARK = {
    "ground": "#0F1115", "panel": "#171A20", "well": "#1E222A", "selected": "#1C2744", "hair": "#2A2F38",
    "ink": "#ECEEF2", "ink2": "#A9B0BC", "ink3": "#959DAA", "edge": "#6E7685",
    "primary": "#8AA9FF", "on-primary": "#0B1530",
    "danger": "#F2806F", "danger-tint": "#3A1D1B",
    "warn": "#EFA65C", "warn-tint": "#32250F", "on-warn": "#1C1206",
    "success": "#5CCB96", "success-tint": "#122A20", "on-success": "#06170F",
    "disabled": "#262B34",
}
SWATCH_KEYS = ["ground", "panel", "well", "selected", "hair", "edge", "ink", "ink2", "ink3", "primary", "on-primary",
               "danger", "danger-tint", "warn", "warn-tint", "success", "success-tint", "disabled"]

# Every pair where text sits in the mockups; all must reach 4.5:1.
TEXT_PAIRS = [
    ("ink", "ground"), ("ink", "panel"), ("ink", "well"), ("ink", "selected"),
    ("ink2", "ground"), ("ink2", "panel"), ("ink2", "well"), ("ink2", "selected"),
    ("ink3", "ground"), ("ink3", "panel"), ("ink3", "well"), ("ink3", "disabled"),
    ("primary", "panel"), ("primary", "selected"), ("primary", "well"), ("on-primary", "primary"),
    ("danger", "panel"), ("danger", "danger-tint"), ("ink", "danger-tint"),
    ("warn", "panel"), ("warn", "warn-tint"), ("ink", "warn-tint"), ("ink2", "warn-tint"),
    ("success", "panel"), ("success", "success-tint"), ("ink", "success-tint"), ("ink2", "success-tint"),
]
# Non-text parts that carry meaning (filled buttons, step dots, icon tiles, radio rings, status glyphs): 3:1.
UI_PAIRS = [
    ("primary", "panel"), ("primary", "ground"), ("danger", "panel"), ("warn", "panel"), ("success", "panel"),
    ("edge", "panel"), ("on-warn", "warn"), ("on-success", "success"), ("on-primary", "primary"),
]

SANS = '"Inter", "Inter Variable", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Helvetica Neue", system-ui, sans-serif'
MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace'


# ---------------------------------------------------------------- contrast helpers
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
        out += [f"{mode}: {a} on {b} = {ratio(pal[a], pal[b]):.2f}:1 (text needs 4.5)"
                for a, b in TEXT_PAIRS if ratio(pal[a], pal[b]) < 4.5]
        out += [f"{mode}: {a} against {b} = {ratio(pal[a], pal[b]):.2f}:1 (UI part needs 3)"
                for a, b in UI_PAIRS if ratio(pal[a], pal[b]) < 3]
    return out


def contrast_rows(pal):
    rows = []
    for a, b in TEXT_PAIRS:
        r = ratio(pal[a], pal[b])
        rows.append(f"<tr><td><span class='chip' style='background:{pal[b]};color:{pal[a]}'>Aa</span>{a} on {b}</td>"
                    f"<td class='num'>{r:.2f}:1</td><td>{'text AA' if r >= 4.5 else 'FAIL'}</td></tr>")
    for a, b in UI_PAIRS:
        r = ratio(pal[a], pal[b])
        rows.append(f"<tr class='ui'><td><span class='chip' style='background:{pal[b]}'><i style='background:{pal[a]}'></i></span>"
                    f"{a} part on {b}</td><td class='num'>{r:.2f}:1</td><td>{'UI 3:1' if r >= 3 else 'FAIL'}</td></tr>")
    return "<table class='ct'><thead><tr><th>Pair</th><th>Ratio</th><th>Needs</th></tr></thead><tbody>" + "".join(rows) + "</tbody></table>"


def swatches(pal):
    return "".join(f"<div class='sw'><span style='background:{pal[k]}'></span><b>{k}</b><code>{pal[k]}</code></div>"
                   for k in SWATCH_KEYS)


def css_vars(pal):
    return ";".join(f"--{k}:{v}" for k, v in pal.items())


# ---------------------------------------------------------------- images
def data_uris():
    out = {}
    sips = shutil.which("sips")
    with tempfile.TemporaryDirectory() as tmp:
        for f, *_ in SHOTS:
            src = REFS / f
            data = src.read_bytes()
            if sips:
                dst = pathlib.Path(tmp) / f
                subprocess.run([sips, "--resampleWidth", "900", "-s", "format", "jpeg", "-s", "formatOptions", "80",
                                str(src), "--out", str(dst)], check=True, capture_output=True, timeout=60)
                data = dst.read_bytes()
            out[f] = "data:image/jpeg;base64," + base64.b64encode(data).decode()
    return out


# ---------------------------------------------------------------- icons (stroke = currentColor)
def ico(path, size=16, sw=1.7):
    return (f"<svg class='i' width='{size}' height='{size}' viewBox='0 0 24 24' fill='none' stroke='currentColor' "
            f"stroke-width='{sw}' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>{path}</svg>")


I_LOGO = ico("<path d='M7 3.5h7.5L19 8v12.5H7z'/><path d='M14.5 3.5V8H19'/><path d='M10 12.5h6M10 16h4'/>", 18, 2)
I_UNITS = ico("<rect x='3.5' y='3.5' width='7' height='7' rx='1.5'/><rect x='13.5' y='3.5' width='7' height='7' rx='1.5'/><rect x='3.5' y='13.5' width='7' height='7' rx='1.5'/><rect x='13.5' y='13.5' width='7' height='7' rx='1.5'/>", 18)
I_DOC = ico("<path d='M7 3.5h7l4 4v13H7z'/><path d='M14 3.5v4h4M10 12h5M10 15.5h5'/>", 18)
I_UPLOAD = ico("<path d='M12 15V4.5M7.5 9 12 4.5 16.5 9'/><path d='M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15'/>", 18)
I_APPROVE = ico("<path d='M12 3.5 19.5 6v5.5c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6z'/><path d='m8.8 12 2.3 2.3 4.2-4.6'/>", 18)
I_GEAR = ico("<circle cx='12' cy='12' r='3'/><path d='M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7'/>", 18)
I_SEARCH = ico("<circle cx='11' cy='11' r='6.5'/><path d='m20 20-4.2-4.2'/>", 15)
I_CHEV = ico("<path d='m9 6 6 6-6 6'/>", 13)
I_CHECK = ico("<path d='M5 12.5 9.5 17 19 7.5'/>", 14, 2.2)
I_CHECK_S = ico("<path d='M5 12.5 9.5 17 19 7.5'/>", 12, 2.6)
I_PEN = ico("<path d='M4 20h4L19 9l-4-4L4 16z'/><path d='m13.5 6.5 4 4'/>", 13, 2)
I_ALERT = ico("<path d='M12 4 3 19.5h18z'/><path d='M12 10v4M12 16.8v.2'/>", 17, 2)
I_INFO = ico("<circle cx='12' cy='12' r='8.5'/><path d='M12 11v5M12 8v.2'/>", 17, 2)
I_LINK = ico("<path d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'/><path d='M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'/>", 17, 2)
I_SHIELD = ico("<path d='M12 3.5 19.5 6v5.5c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6z'/><path d='m8.8 12 2.3 2.3 4.2-4.6'/>", 17, 2)
I_FILE = ico("<path d='M7 3.5h7l4 4v13H7z'/><path d='M14 3.5v4h4'/><path d='M9.5 12.5h5v5h-5zM9.5 15h5M12 12.5v5'/>", 18)
I_ARROW = ico("<path d='M5 12h14M13 6l6 6-6 6'/>", 13, 2)
I_CLOCK = ico("<circle cx='12' cy='12' r='8.5'/><path d='M12 7.5V12l3 2'/>", 14)
I_LOCK = ico("<rect x='5' y='10.5' width='14' height='10' rx='2'/><path d='M8 10.5V8a4 4 0 0 1 8 0v2.5'/>", 13, 2)
I_PIN = ico("<path d='M9 4h6l-1 5 3 3v2H7v-2l3-3z'/><path d='M12 14v6'/>", 13, 2)
I_QUOTE = ico("<path d='M9.5 7H6a1 1 0 0 0-1 1v4h4v1.5A3.5 3.5 0 0 1 5.5 17'/><path d='M19 7h-3.5a1 1 0 0 0-1 1v4h4v1.5A3.5 3.5 0 0 1 15 17'/>", 17, 1.9)
I_RETRY = ico("<path d='M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9'/><path d='M4.5 4.5V9H9'/>", 12, 2.2)
I_LIST = ico("<path d='M9 6h11M9 12h11M9 18h11'/><circle cx='4.8' cy='6' r='.9'/><circle cx='4.8' cy='12' r='.9'/><circle cx='4.8' cy='18' r='.9'/>", 15)
I_LINK_S = ico("<path d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'/><path d='M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'/>", 15)
I_UNDO = ico("<path d='M9 14 4.5 9.5 9 5'/><path d='M4.5 9.5H15a5 5 0 0 1 0 10h-3'/>", 15)
I_REDO = ico("<path d='M15 14l4.5-4.5L15 5'/><path d='M19.5 9.5H9a5 5 0 0 0 0 10h3'/>", 15)
I_DOWN = ico("<path d='m6 9 6 6 6-6'/>", 12, 2)


# Status glyphs: filled shapes, so state reads from shape and words as well as colour.
def glyph(kind, size=12):
    shapes = {
        "draft": "<circle cx='8' cy='8' r='5.6' fill='none' stroke='currentColor' stroke-width='1.8'/>",
        "review": "<circle cx='8' cy='8' r='5.6' fill='none' stroke='currentColor' stroke-width='1.8'/><path d='M8 2.4a5.6 5.6 0 0 1 0 11.2z' fill='currentColor'/>",
        "sub": "<circle cx='8' cy='8' r='6.4' fill='currentColor'/><path d='M8 11V5.4M5.6 7.6 8 5.2l2.4 2.4' stroke='var(--panel)' stroke-width='1.7' fill='none' stroke-linecap='round' stroke-linejoin='round'/>",
        "ok": "<circle cx='8' cy='8' r='6.4' fill='currentColor'/><path d='m5.2 8.2 1.9 1.9 3.7-4' stroke='var(--panel)' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'/>",
        "bad": "<path d='M8 1.6 15 14H1z' fill='currentColor'/><path d='M8 6.2v3.6M8 11.6v.2' stroke='var(--panel)' stroke-width='1.7' stroke-linecap='round'/>",
        "stop": "<path d='M5.3 1.5h5.4l3.8 3.8v5.4l-3.8 3.8H5.3l-3.8-3.8V5.3z' fill='currentColor'/><path d='M5.6 8h4.8' stroke='var(--panel)' stroke-width='1.8' stroke-linecap='round'/>",
        "adv": "<circle cx='8' cy='8' r='6.4' fill='currentColor'/><path d='M8 7.4v4M8 4.9v.2' stroke='var(--panel)' stroke-width='1.8' stroke-linecap='round'/>",
    }
    return f"<svg class='g' width='{size}' height='{size}' viewBox='0 0 16 16' aria-hidden='true'>{shapes[kind]}</svg>"


def st(kind, label):
    return f"<span class='tag t-{kind}'>{glyph(kind)}{label}</span>"


def code(s):
    return f"<code class='cd'>{html.escape(s)}</code>"


def av(initials, tone=""):
    return f"<span class='av {tone}'>{initials}</span>"


NAV = {
    "units": I_UNITS, "lessons": I_DOC, "upload": I_UPLOAD, "approve": I_APPROVE,
}


def frame(active, crumbs, right, body, cls=""):
    nav = "".join(f"<span class='nb{' on' if k == active else ''}'>{v}</span>" for k, v in NAV.items())
    crumb = f"<span class='sep'>{I_CHEV}</span>".join(crumbs[:-1] + [f"<b>{crumbs[-1]}</b>"])
    return f"""<div class="fr {cls}">
<nav class="nav"><span class="logo">{I_LOGO}</span>{nav}<span class="grow"></span><span class="nb">{I_GEAR}</span></nav>
<header class="top"><div class="crumb">{crumb}</div><span class="grow"></span>{right}
<div class="search">{I_SEARCH}<span>Search</span><kbd>⌘K</kbd></div><span class="av me">{ico("<circle cx='12' cy='9' r='3.5'/><path d='M5.5 19.5a6.5 6.5 0 0 1 13 0'/>", 15)}</span></header>
<main class="main">{body}</main></div>"""


def stepper(states, current):
    out = []
    for n, s in enumerate(states):
        if n < current:
            dot, cls, small = f"<span class='dot done'>{I_CHECK_S}</span>", "done", f"Step {n + 1}/5"
        elif n == current:
            dot, cls, small = f"<span class='dot now'>{I_PEN if current == 1 else glyph('sub', 12)}</span>", "now", f"Step {n + 1}/5 · now"
        else:
            dot, cls, small = "<span class='dot next'></span>", "next", f"Step {n + 1}/5"
        out.append(f"<div class='step {cls}'>{dot}<div><small>{small}</small><b>{s}</b></div></div>")
    return "<div class='stepper'>" + "<span class='bar'></span>".join(out) + "</div>"


STATES = ["Draft", "In review", "Submitted", "Approved", "Exported"]

# ---------------------------------------------------------------- 4. mockups (copy: LOOK_SHEET_COPY.md)
M1 = frame("upload", ["Units", "Grade 6 · Unit 4", "Validation report"], "", f"""
<div class="m1">
 <section class="sheet m1-sheet">
  <div class="sh-head">
   <div><p class="eyebrow">Outline v1 · validation report</p>
   <h2>Grade 6 · Unit 4 · <em>The Lightning Thief</em></h2>
   <p class="meta"><span class="file">{I_FILE}{code('g6-u4-outline.xlsx')}</span><span class="dotsep"></span>uploaded by A. Chen</p></div>
  </div>
  <h3 class="sec"><span>{glyph('stop', 13)}Errors</span><small>5 errors to confirm</small></h3>
  <table class="tbl err">
   <tbody>
    <tr><td class="n"><span class="num-b">1</span></td><td class="where"><b>Unit</b></td>
     <td>The sheet says <b>G6, U4</b>; every filename says <b>U3</b>.<div class="fix">{I_ARROW}Confirm <b>U4</b></div></td>
     <td class="act"><span class="btn sm">{I_CHECK}Confirm</span><span class="btn sm ghost">Edit</span></td></tr>
    <tr><td class="n"><span class="num-b">2</span></td><td class="where"><b>Row 8 · Lesson 4 · Focus</b></td>
     <td>{code('RL.6.1, 6.2 L.6.4')} — "6.2" has no strand.<div class="fix">{I_ARROW}Proposed: {code('RL.6.1 · RL.6.2 · L.6.4')}</div></td>
     <td class="act"><span class="btn sm">{I_CHECK}Confirm</span><span class="btn sm ghost">Edit</span></td></tr>
    <tr><td class="n"><span class="num-b">3</span></td><td class="where"><b>Rows 30, 34, 39</b></td>
     <td>{code('RL.6.9.a')} does not exist.<div class="fix">{I_ARROW}Drop it ({code('RL.6.9')} is already listed)</div></td>
     <td class="act"><span class="btn sm">{I_CHECK}Confirm</span><span class="btn sm ghost">Edit</span></td></tr>
   </tbody>
  </table>
  <h3 class="sec"><span class="wn">{glyph('adv', 13)}Warnings</span><small>each shows its default</small></h3>
  <table class="tbl warnt">
   <thead><tr><th>Where</th><th>What the sheet says</th><th>Default</th></tr></thead>
   <tbody>
    <tr><td class="where">Row 8 · Note in <i>Foundational Skills</i></td><td>"Instead, think about using morphology…"</td>
     <td><span class="seg"><b>Apply</b><span>Show to reviewer only</span><span>Ignore</span></span></td></tr>
    <tr><td class="where">Row 9 · <i>Text Set Choice</i></td><td class="caps">"WRITER MUST SLECT AND WRITE TO AN EXCERPT OF THE TEXT"</td>
     <td>becomes an <b>excerpt slot</b></td></tr>
    <tr><td class="where">Row 9 · <i>Vocabulary</i></td><td>"Cap at 6 words per lesson"</td><td><b>unit rule</b> for rows 8–23</td></tr>
    <tr><td class="where">Row 8 · {code('ELD.PII.6.5')}</td><td>Sheet says "Use transitions to connect ideas"; official strand is <i>Modifying to add details</i></td>
     <td><span class="seg"><b>Keep</b><span>Re-map to {code('PII.6.2b')}</span></span></td></tr>
    <tr><td class="where">Row 39 · <i>Homework</i></td><td>"Warn students about potentially triggering scene in tonight's reading (references to domestic abuse)"</td>
     <td><span class="btn sm">{I_CHECK}Confirm as a safety flag</span></td></tr>
   </tbody>
  </table>
  <div class="okrow">{glyph('ok', 14)}<b>Row 10 · Lesson 6</b><span>OK · 0 warnings</span></div>
 </section>
 <aside class="rail m1-rail">
  <div class="card">
   <p class="label">Summary</p>
   <dl class="stats">
    <div><dt>Teaching days</dt><dd>47</dd></div>
    <div class="bad"><dt>{glyph('stop', 12)}Errors to confirm</dt><dd>5</dd></div>
    <div class="wn"><dt>{glyph('adv', 12)}ELD labels flagged</dt><dd>7</dd></div>
    <div class="wn"><dt>{glyph('adv', 12)}Bad filenames</dt><dd>2</dd></div>
   </dl>
  </div>
  <div class="banner warn"><span class="tile">{I_ALERT}</span><div><b>5 errors to confirm</b><span>Generate stays off: 5 errors to confirm</span></div></div>
  <span class="btn pri big dis">{I_LOCK}Generate 47 lessons</span>
 </aside>
</div>""")

ROWS = [
    ("Lesson 4: The Lightning Thief, Chapter 1", "Reading", st("review", "In review"), "3", "1", ("MO", "M. Okafor"), "Waits on Lesson 5's excerpt"),
    ("Lesson 5: Comparing Percy and Soongoora", "Writing", st("sub", "Submitted"), "0", "2", ("JR", "J. Rivera"), "—"),
    ("Lesson 31: Comparing the Gods' Home", "Writing", st("draft", "Draft"), "2", "2", None, f"{glyph('stop', 12)} Safety flag open"),
    ("Flex Day: Meaning-Making Huddle", "Flex Day", st("draft", "Draft"), "1", "1", None, f"Standard proposed: {code('RL.6.7')}"),
    ("Lesson 22", "Reading", st("bad", "Failed"), "—", "—", None, f"Truncated · <span class='lnk'>{I_RETRY}Retry</span>"),
    ("Lesson 6", "Reading", st("ok", "Approved"), "0", "0", ("JR", "J. Rivera"), "Approved · v2"),
]


def board_rows():
    out = []
    for title, typ, state, blk, adv, rev, note in ROWS:
        b = f"<span class='blk'>{glyph('stop', 12)}{blk}</span>" if blk not in ("0", "—") else f"<span class='zero'>{blk}</span>"
        a = f"<span class='advn'>{adv}</span>" if adv not in ("0", "—") else f"<span class='zero'>{adv}</span>"
        r = f"<span class='who'>{av(rev[0])}{rev[1]}</span>" if rev else "<span class='zero'>—</span>"
        out.append(f"<tr><td class='lt'><b>{title}</b></td><td class='mut'>{typ}</td><td>{state}</td><td class='c'>{b}</td>"
                   f"<td class='c'>{a}</td><td>{r}</td><td class='mut'>{note}</td></tr>")
    return "".join(out)


ROLL = [("draft", "Draft", 34), ("review", "In review", 6), ("sub", "Submitted", 2), ("ok", "Approved", 3), ("bad", "Failed", 2)]

M2 = frame("units", ["Units", "Grade 6", "Unit 4"], "", f"""
<div class="m2">
 <div class="pagehead"><div><p class="eyebrow">Unit board</p><h2>Unit 4 · <em>The Lightning Thief</em></h2></div><span class="count">47 lessons</span></div>
 <div class="m2-top">
  <section class="sheet roll">
   <p class="label">Where the 47 lessons are</p>
   <div class="rollcells">{''.join(f"<div class='rc r-{k}'><span class='rk'>{glyph(k, 13)}{lab}</span><b class='num'>{n}</b></div>" for k, lab, n in ROLL)}</div>
   <div class="track" role="img" aria-label="Draft 34, In review 6, Submitted 2, Approved 3, Failed 2">{''.join(f"<span class='seg-{k}' style='flex:{n}'></span>" for k, lab, n in ROLL)}</div>
  </section>
  <section class="sheet north">
   <p class="label">Reviewer minutes per approved lesson</p>
   <div class="nbig"><b class="num">24</b><span>min</span><small>median · <i>n</i> = 3</small></div>
   <div class="guards"><div><span>fast approvals</span><b class="num">0 of 3</b></div><div><span>approved</span><b class="num">3 of 47</b></div></div>
   <p class="fine">No baseline yet (AQ-14). Measured with us as reviewers.</p>
  </section>
 </div>
 <section class="sheet board">
  <div class="boardbar"><span class="segc"><b>All</b><span>Draft</span><span>In review</span><span>Submitted</span><span>Approved</span><span>Failed</span></span>
   <span class="sortnote">Sorted by blocking issues</span></div>
  <table class="tbl brd"><thead><tr><th>Lesson</th><th>Type</th><th>State</th><th class="c">Blocking</th><th class="c">Advisory</th><th>Reviewer</th><th>Note</th></tr></thead>
  <tbody>{board_rows()}</tbody></table>
 </section>
</div>""")

M3_BODY = f"""
<div class="m3">
 <div class="m3-step">{stepper(STATES, 1)}</div>
 <aside class="outline">
  <p class="label">Sections · 50 min</p>
  <ol>
   <li><span>Launch</span><b class="num">5</b></li>
   <li class="on"><span>Literacy Lab</span><b class="num">10</b><i class="pin">{glyph('stop', 11)}</i></li>
   <li><span>Learning in Action</span><b class="num">30</b></li>
   <li class="sub"><span>Part A</span><b class="num">15</b><i class="pin">{glyph('stop', 11)}</i></li>
   <li class="sub"><span>Part B</span><b class="num">15</b><i class="pres">MO</i></li>
   <li><span>Look Back</span><b class="num">5</b></li>
   <li><span>Homework</span><b class="num"></b><i class="pin">{glyph('stop', 11)}</i></li>
  </ol>
 </aside>
 <section class="sheet doc">
  <div class="tools"><span class="tsel">Paragraph{I_DOWN}</span><span class="tsep"></span><b>B</b><i>I</i><u>U</u><span class="tsep"></span>{I_LIST}{I_LINK_S}<span class="tsep"></span>{I_UNDO}{I_REDO}</div>
  <div class="page">
   <h2>Lesson 4: The Lightning Thief, Chapter 1</h2>
   <p class="meta">Reading<span class="dotsep"></span>50 min<span class="dotsep"></span>{st('review', 'In review')}<span class="ver">v3</span></p>
   <p class="slabel"><span>Literacy Lab</span><span>10 min</span></p>
   <h3>Introduce New Words Using Morphemes</h3>
   <p><b>Say:</b> "Today we'll use word parts to unlock new words. The root <i>mort-</i> means death."</p>
   <p><b>Ask:</b> "If <i>mort</i> means death, what does <i>immortal</i> mean?"</p>
   <p class="sample"><span>Sample response</span>"Not able to die. <i>Im-</i> means not."</p>
   <p class="slabel"><span>Learning in Action · Part A: Percy's Voice ({code('RL.6.1')}, {code('RL.6.4')})</span><span>15 min</span></p>
   <div class="slot"><span class="tile soft">{I_QUOTE}</span>
    <div><p>Reviewer to insert: one sentence from Ch. 1, pp. 1–8, where Percy's sarcastic word choice sets the tone</p>
    <p class="rights">rights: {code('short-quote-commentary')}</p></div>
    <span class="btn pri sm">Insert quote</span><span class="mk">1</span></div>
  </div>
 </section>
 <aside class="rail ev">
  <div class="evhead"><b>Issues · Standards</b></div>
  <p class="label row"><span>Issues</span><span class="cnt"><span class="bk">{glyph('stop', 11)}3 blocking</span><span class="av2">{glyph('adv', 11)}1 advisory</span></span></p>
  <div class="ic"><div class="ich"><span class="tag t-stop cap">{glyph('stop', 11)}Blocking</span><p>Quote placeholder open</p><span class="ino">1</span></div>{code('G6.U4.L4.LearningInAction.PartA')}</div>
  <div class="ic"><div class="ich"><span class="tag t-stop cap">{glyph('stop', 11)}Blocking</span><p>Homework waits on Lesson 5's excerpt</p><span class="ino">2</span></div></div>
  <div class="ic"><div class="ich"><span class="tag t-stop cap">{glyph('stop', 11)}Blocking</span><p>{code('L.6.4.b')} was chosen by the tool — confirm or remove</p><span class="ino">3</span></div></div>
  <div class="ic"><div class="ich"><span class="tag t-adv cap">{glyph('adv', 11)}Advisory</span><p>{code('ELD.PII.6.5')} label names another strand</p><span class="ino">4</span></div></div>
  <p class="label row st-h"><span>Standards</span><span class="cnt">3</span></p>
  <table class="tbl stds"><tbody>
   <tr><td>{code('RL.6.1')}</td><td><span class="src">from the outline</span><span class="tc">taught: Part A · checked: Look Back</span></td></tr>
   <tr><td>{code('RL.6.2')}</td><td><span class="src">outline, fixed by A. Chen</span><span class="tc">taught: Part B · checked: Pulse Check</span></td></tr>
   <tr class="pick"><td>{code('L.6.4.b')}</td><td><span class="tag t-adv">{glyph('adv', 11)}chosen by the tool · confirm</span><span class="tc">taught: Literacy Lab · checked: Literacy Lab check</span></td></tr>
  </tbody></table>
  <blockquote class="official"><span>Official text · {code('L.6.4.b')}</span>"Use common, grade-appropriate Greek or Latin affixes and roots as clues to the meaning of a word (e.g., audience, auditory, audible)."</blockquote>
 </aside>
 <footer class="foot"><span class="mut">{I_CLOCK}Active review time on this lesson is recorded and shown only as unit totals.</span><span class="grow"></span>
  <span class="blkn">{glyph('stop', 13)}3 blocking issues</span><span class="btn pri dis">{I_LOCK}Submit for approval</span></footer>
</div>"""

M3_RIGHT = f"<span class='presence'>{av('MO', 'ring')}M. Okafor is editing Part B</span>"
M3 = frame("lessons", ["Unit 4", "Lesson 4"], M3_RIGHT, M3_BODY)
M3_DARK = frame("lessons", ["Unit 4", "Lesson 4"], M3_RIGHT, M3_BODY)

CHECKS = [
    ("Quotes and excerpts", f"excerpt inserted by J. Rivera from <i>Zanzibar Tales</i> (Bateman trans.) · rights: {code('public-domain')} · source recorded"),
    ("Standards taught and checked", f"{code('W.6.2.a')} {code('W.6.2.b')} {code('W.6.2.f')} confirmed by J. Rivera"),
    ("ELD supports keep the same text and task", ""),
    ("Social content reviewed", ""),
    ("AI-assisted spans", "1 accepted by J. Rivera"),
]

M4 = frame("approve", ["Unit 4", "Approvals", "Lesson 5"], "", f"""
<div class="m4">
 <div class="m3-step">{stepper(STATES, 2)}</div>
 <section class="sheet m4-sheet">
  <p class="eyebrow">Approval review</p>
  <h2>Lesson 5: Comparing Percy and Soongoora</h2>
  <p class="meta">Writing<span class="dotsep"></span>{st('sub', 'Submitted')}<span>by J. Rivera</span><span class="dotsep"></span><span class="snap">{I_PIN}snapshot {code('9f3c…a21e')}</span></p>
  <div class="banner info"><span class="tile">{I_LINK}</span><div><b>Lesson 4 is waiting on this lesson's excerpt.</b></div></div>
  <h3 class="sec"><span>Checklist</span><small>each with its evidence</small></h3>
  <ul class="checks">{''.join(f"<li><span class='ck'>{glyph('ok', 18)}</span><div><b>{t}</b>{f'<p>{e}</p>' if e else ''}</div></li>" for t, e in CHECKS)}</ul>
 </section>
 <aside class="rail decide">
  <div class="card">
   <p class="label">Your decision</p>
   <div class="banner ok"><span class="tile">{I_SHIELD}</span><div><b>Four eyes</b><span>You did not edit this lesson, so you can approve it.</span></div></div>
   <fieldset class="quality"><legend>Draft quality <em>(required)</em></legend>
    <label><span class="radio"></span>Usable as drafted</label>
    <label class="on"><span class="radio"></span><b>Usable with edits</b></label>
    <label><span class="radio"></span>Rewritten</label>
   </fieldset>
   <span class="btn pri big">{I_CHECK}Approve this version</span>
   <span class="btn big">Request changes</span>
   <p class="fine">{I_PIN}Approving pins snapshot 9f3c…a21e. If it changes before you approve, you'll be asked to reload.</p>
  </div>
 </aside>
</div>""")

MOCKUPS = [
    ("M1 · SCR-4 Validation report", "FLOW-3. The outline author's first look at the sheet: errors to confirm before any money is spent, warnings with their defaults.", M1),
    ("M2 · SCR-8 Unit board", "FLOW-6. Where the 47 lessons are, the north-star tile with its n and guard numbers, the queue sorted by what blocks.", M2),
    ("M3 · SCR-9 Lesson workspace, Lesson 4", "FLOW-7, WP-1. The lesson as a page on the desk, the stepper above, the Issues · Standards rail beside it.", M3),
    ("M4 · SCR-14 Approval review, Lesson 5", "FLOW-12, WP-2. The approver sees the pinned snapshot, the checklist with its evidence, and one decision card.", M4),
]

# ---------------------------------------------------------------- CSS
CSS = """
.fr{width:1200px;height:760px;flex:none;display:grid;grid-template-columns:60px minmax(0,1fr);grid-template-rows:56px minmax(0,1fr);
 background:var(--ground);color:var(--ink);border:1px solid var(--hair);border-radius:14px;overflow:hidden;font:13.5px/1.45 SANS;
 -webkit-font-smoothing:antialiased;box-shadow:0 1px 2px rgba(16,24,40,.05),0 24px 48px -24px rgba(16,24,40,.22);text-align:left}
.fr *{box-sizing:border-box}.fr p{margin:0}.fr h2,.fr h3{margin:0}
.fr .i{flex:none;display:block}.fr .g{flex:none;display:block}
.fr .grow{flex:1}
.fr .nav{grid-row:1/3;background:var(--panel);border-right:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:12px 0;gap:6px}
.fr .logo{width:34px;height:34px;border-radius:9px;background:var(--primary);color:var(--on-primary);display:grid;place-items:center;margin-bottom:14px}
.fr .nb{width:38px;height:38px;border-radius:9px;display:grid;place-items:center;color:var(--ink3)}
.fr .nb.on{background:var(--selected);color:var(--primary)}
.fr .top{background:var(--panel);border-bottom:1px solid var(--hair);display:flex;align-items:center;gap:16px;padding:0 20px 0 24px}
.fr .crumb{display:flex;align-items:center;gap:8px;color:var(--ink3);font-size:13px}.fr .crumb b{color:var(--ink);font-weight:600}.fr .crumb .sep{color:var(--edge)}
.fr .search{display:flex;align-items:center;gap:8px;height:34px;width:210px;padding:0 8px 0 10px;border-radius:8px;background:var(--well);color:var(--ink3);font-size:13px}
.fr .search kbd{margin-left:auto;font:11px/1 MONO;color:var(--ink3);background:var(--panel);border:1px solid var(--hair);border-radius:5px;padding:3px 5px}
.fr .av{width:26px;height:26px;border-radius:50%;display:inline-grid;place-items:center;font-size:10.5px;font-weight:650;background:var(--selected);color:var(--primary);flex:none;letter-spacing:.02em}
.fr .av.me{width:32px;height:32px;background:var(--well);color:var(--ink2)}
.fr .av.ring{box-shadow:0 0 0 2px var(--panel),0 0 0 3.5px var(--primary)}
.fr .presence{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink2);padding-right:6px}
.fr .main{min-height:0;overflow:hidden;padding:22px 28px}
.fr .sheet{background:var(--panel);border:1px solid var(--hair);border-radius:12px;box-shadow:0 1px 2px rgba(16,24,40,.04),0 10px 28px -16px rgba(16,24,40,.16)}
.t-dark .sheet,.t-dark .stepper,.t-dark .card{box-shadow:none}
.fr .eyebrow{font-size:12px;font-weight:600;color:var(--ink3);letter-spacing:.01em;margin-bottom:4px}
.fr h2{font-size:22px;line-height:1.2;font-weight:650;letter-spacing:-.018em;text-wrap:balance}.fr h2 em{font-style:italic;font-weight:650}
.fr .meta{display:flex;align-items:center;gap:8px;color:var(--ink2);font-size:13px;margin-top:8px;flex-wrap:wrap}
.fr .dotsep{width:3px;height:3px;border-radius:50%;background:var(--edge)}
.fr .label{font-size:12px;font-weight:600;color:var(--ink3);letter-spacing:.01em}
.fr .label.row{display:flex;justify-content:space-between;align-items:center}
.fr .fine{font-size:12px;color:var(--ink3);line-height:1.45}
.fr .mut{color:var(--ink2)}
.fr .num{font-variant-numeric:tabular-nums}
.fr .cd{font:11.5px/1.5 MONO;background:var(--well);color:var(--ink);padding:1px 6px;border-radius:5px;white-space:nowrap}
.fr .tag{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px 0 7px;border-radius:6px;font-size:12px;font-weight:600;white-space:nowrap}
.fr .tag.cap{text-transform:uppercase;letter-spacing:.06em;font-size:10.5px;height:20px}
.fr .t-draft{background:var(--well);color:var(--ink2)}
.fr .t-review{background:var(--selected);color:var(--primary)}
.fr .t-sub,.fr .t-adv{background:var(--warn-tint);color:var(--warn)}
.fr .t-ok{background:var(--success-tint);color:var(--success)}
.fr .t-bad,.fr .t-stop{background:var(--danger-tint);color:var(--danger)}
.fr .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border-radius:8px;font-weight:600;font-size:13px;
 background:var(--panel);color:var(--ink);border:1px solid var(--hair);box-shadow:0 1px 1px rgba(16,24,40,.05);white-space:nowrap}
.fr .btn.sm{height:28px;padding:0 10px;font-size:12.5px}
.fr .btn.ghost{background:transparent;border-color:transparent;box-shadow:none;color:var(--primary)}
.fr .btn.pri{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
.fr .btn.big{height:40px;width:100%;font-size:14px}
.fr .btn.dis{background:var(--disabled);border-color:var(--disabled);color:var(--ink3);box-shadow:none}
.fr .banner{display:flex;align-items:center;gap:12px;border-radius:10px;padding:11px 14px;font-size:13px}
.fr .banner b{display:block;font-weight:600;color:var(--ink)}.fr .banner span:not(.tile){display:block;color:var(--ink2);font-size:12.5px;margin-top:1px}
.fr .banner.warn{background:var(--warn-tint)}.fr .banner.warn .tile{background:var(--warn);color:var(--on-warn)}
.fr .banner.ok{background:var(--success-tint)}.fr .banner.ok .tile{background:var(--success);color:var(--on-success)}
.fr .banner.info{background:var(--selected)}.fr .banner.info .tile{background:var(--primary);color:var(--on-primary)}
.fr .tile{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:none}
.fr .tile.soft{background:var(--selected);color:var(--primary)}
.fr .card{background:var(--panel);border:1px solid var(--hair);border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.fr .tbl{width:100%;border-collapse:collapse}
.fr .tbl th{font-size:12px;font-weight:600;color:var(--ink3);text-align:left;padding:0 10px 8px;border-bottom:1px solid var(--hair)}
.fr .tbl td{padding:12px 10px;border-bottom:1px solid var(--hair);vertical-align:top}
.fr .tbl tr:last-child td{border-bottom:0}
.fr .tbl .c{text-align:center}
.fr .sec{display:flex;align-items:baseline;justify-content:space-between;font-size:14px;font-weight:650;margin:20px 0 6px}
.fr .sec span{display:inline-flex;align-items:center;gap:7px;color:var(--danger)}.fr .sec span.wn{color:var(--warn)}
.fr .m4 .sec span{color:var(--ink)}
.fr .sec small{font-size:12px;font-weight:500;color:var(--ink3)}
/* stepper */
.fr .stepper{display:inline-flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:8px 14px 8px 10px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.fr .step{display:flex;align-items:center;gap:10px}.fr .step small{display:block;font-size:11px;color:var(--ink3);line-height:1.2}.fr .step b{display:block;font-size:13px;font-weight:600;line-height:1.3}
.fr .step.next b{color:var(--ink2);font-weight:500}
.fr .dot{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;flex:none}
.fr .dot.done{background:var(--success);color:var(--on-success)}
.fr .dot.now{background:var(--primary);color:var(--on-primary);box-shadow:0 0 0 4px var(--selected)}
.fr .dot.next{background:var(--panel);border:1.5px solid var(--edge)}
.fr .stepper .bar{width:22px;height:1.5px;background:var(--hair)}
/* M1 */
.fr .m1{display:grid;grid-template-columns:minmax(0,1fr) 288px;gap:22px;height:100%}
.fr .m1-sheet{padding:18px 24px 12px;overflow:hidden}
.fr .m1-sheet .sec{margin:14px 0 4px}
.fr .sh-head{padding-bottom:4px}
.fr .file{display:inline-flex;align-items:center;gap:6px;color:var(--ink3)}
.fr .err td{padding:7px 8px}
.fr .err .n{width:30px;padding-left:0}.fr .num-b{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;background:var(--danger-tint);color:var(--danger);font-weight:650;font-size:12px}
.fr .err .where{width:176px}.fr .warnt .where{width:150px;color:var(--ink2)}
.fr .fix{display:flex;align-items:center;gap:6px;margin-top:4px;color:var(--ink2);font-size:12.5px}.fr .fix .i{color:var(--primary)}
.fr .act{width:156px;text-align:right;white-space:nowrap}.fr .act .btn{margin-left:4px}
.fr .warnt td{padding:6px 8px;font-size:12.6px;line-height:1.4}.fr .warnt th{padding:0 8px 6px}
.fr .warnt td:last-child{width:226px;color:var(--ink2)}
.fr .caps{letter-spacing:.01em}
.fr .seg{display:inline-flex;background:var(--well);border-radius:7px;padding:2px;gap:2px;font-size:11.5px;white-space:nowrap}
.fr .seg>*{padding:2px 7px;border-radius:5px;color:var(--ink2);display:inline-flex;align-items:center;gap:4px}
.fr .seg>b{background:var(--panel);color:var(--ink);box-shadow:0 1px 2px rgba(16,24,40,.1)}
.fr .seg .cd{font-size:10.5px;padding:0 4px;background:transparent}
.fr .okrow{display:flex;align-items:center;gap:8px;margin-top:6px;padding:10px 12px;border-radius:8px;background:var(--success-tint);color:var(--success);font-size:13px}
.fr .okrow b{color:var(--ink);font-weight:600}.fr .okrow span{color:var(--ink2)}
.fr .m1-rail{display:flex;flex-direction:column;gap:14px}
.fr .stats{margin:10px 0 0;display:grid;gap:0}
.fr .stats div{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--hair)}
.fr .stats div:first-child{border-top:0}
.fr .stats dt{display:flex;align-items:center;gap:7px;color:var(--ink2);font-size:13px}.fr .stats dd{margin:0;font-size:20px;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.fr .stats .bad dt .g,.fr .stats .bad dd{color:var(--danger)}.fr .stats .wn dt .g{color:var(--warn)}
/* M2 */
.fr .m2{display:flex;flex-direction:column;gap:16px;height:100%}
.fr .pagehead{display:flex;align-items:flex-end;justify-content:space-between}
.fr .count{font-size:13px;color:var(--ink2);background:var(--panel);border:1px solid var(--hair);border-radius:8px;padding:5px 10px;font-weight:500}
.fr .m2-top{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px}
.fr .roll{padding:16px 18px}
.fr .rollcells{display:grid;grid-template-columns:repeat(5,1fr);margin:12px 0 14px}
.fr .rc{padding:2px 14px;border-left:1px solid var(--hair)}.fr .rc:first-child{border-left:0;padding-left:0}
.fr .rk{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink2)}
.fr .rc b{display:block;font-size:28px;font-weight:650;letter-spacing:-.02em;margin-top:4px}
.fr .r-draft .g{color:var(--ink3)}.fr .r-review .g{color:var(--primary)}.fr .r-sub .g{color:var(--warn)}.fr .r-ok .g{color:var(--success)}.fr .r-bad .g{color:var(--danger)}
.fr .track{display:flex;gap:3px;height:8px}.fr .track span{border-radius:3px}
.fr .seg-draft{background:var(--edge);opacity:.45}.fr .seg-review{background:var(--primary)}.fr .seg-sub{background:var(--warn)}.fr .seg-ok{background:var(--success)}.fr .seg-bad{background:var(--danger)}
.fr .north{padding:16px 18px}
.fr .nbig{display:flex;align-items:baseline;gap:6px;margin:6px 0 10px}.fr .nbig b{font-size:34px;font-weight:650;letter-spacing:-.03em;line-height:1}
.fr .nbig span{font-size:15px;font-weight:600;color:var(--ink2)}.fr .nbig small{margin-left:auto;font-size:12.5px;color:var(--ink2)}
.fr .guards{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.fr .guards div{background:var(--well);border-radius:8px;padding:7px 10px;display:flex;flex-direction:column}
.fr .guards span{font-size:12px;color:var(--ink2)}.fr .guards b{font-size:14px;font-weight:650}
.fr .board{padding:6px 6px 4px;flex:1;min-height:0}
.fr .boardbar{display:flex;align-items:center;justify-content:space-between;padding:10px 12px 12px}
.fr .segc{display:inline-flex;background:var(--well);border-radius:9px;padding:3px;gap:2px;font-size:12.5px}
.fr .segc>*{padding:5px 11px;border-radius:7px;color:var(--ink2);font-weight:500}
.fr .segc>b{background:var(--panel);color:var(--ink);font-weight:600;box-shadow:0 1px 2px rgba(16,24,40,.1)}
.fr .sortnote{font-size:12.5px;color:var(--ink3)}
.fr .brd th{padding:0 12px 8px}.fr .brd td{padding:12px;vertical-align:middle}
.fr .brd .lt b{font-weight:600}
.fr .blk{display:inline-flex;align-items:center;gap:5px;color:var(--danger);font-weight:650;font-variant-numeric:tabular-nums}
.fr .advn{color:var(--warn);font-weight:650}.fr .zero{color:var(--ink3)}
.fr .who{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.fr .brd td.mut{font-size:12.8px}
.fr .brd td.mut .g{display:inline-block;vertical-align:-1px;color:var(--danger)}
.fr .lnk{display:inline-flex;align-items:center;gap:4px;color:var(--primary);font-weight:600}
/* M3 */
.fr .m3{display:grid;grid-template-columns:158px minmax(0,1fr) 372px;grid-template-rows:auto minmax(0,1fr) auto;gap:12px 18px;height:100%}
.fr .main:has(.m3),.fr .main:has(.m4){padding:16px 24px 18px}
.fr .m3 .main{padding:0}
.fr .m3-step{grid-column:1/-1;display:flex;justify-content:center}
.fr .outline{padding-top:4px}
.fr .outline ol{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:2px}
.fr .outline li{display:flex;align-items:center;gap:6px;padding:7px 8px 7px 10px;border-radius:8px;color:var(--ink2);font-size:12.8px;white-space:nowrap}
.fr .outline li span{flex:1}.fr .outline li b{font-weight:500;font-size:12px;color:var(--ink3);min-width:16px;text-align:right}
.fr .outline li.on{background:var(--panel);color:var(--ink);font-weight:600;box-shadow:inset 0 0 0 1px var(--hair)}
.fr .outline li.sub{padding-left:22px}
.fr .outline .pin{color:var(--danger);display:flex}

.fr .outline .pres{order:3;font-style:normal;font-size:9.5px;font-weight:700;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:var(--primary);color:var(--on-primary)}
.fr .doc{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.fr .tools{display:flex;align-items:center;gap:12px;padding:8px 14px;border-bottom:1px solid var(--hair);color:var(--ink2);font-size:13px}
.fr .tools b,.fr .tools i,.fr .tools u{font-family:Georgia,'Times New Roman',serif;font-size:14px;width:16px;text-align:center;color:var(--ink2)}
.fr .tools b{font-family:inherit;font-weight:700}.fr .tools i{font-family:inherit}.fr .tools u{font-family:inherit}
.fr .tsel{display:inline-flex;align-items:center;gap:6px;background:var(--well);border-radius:6px;padding:3px 8px;color:var(--ink);font-weight:500}
.fr .tsep{width:1px;height:16px;background:var(--hair)}
.fr .page{padding:20px 30px 22px;max-width:66ch;overflow:hidden}
.fr .page h2{font-size:23px}
.fr .ver{font:600 11.5px/1 MONO;color:var(--ink2);background:var(--well);padding:5px 7px;border-radius:5px}
.fr .slabel{display:flex;justify-content:space-between;gap:12px;margin:22px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--hair);font-size:12px;font-weight:600;color:var(--ink3)}
.fr .slabel .cd{font-size:11px;font-weight:500;padding:0 4px}.fr .slabel span:last-child{white-space:nowrap}
.fr .page h3{font-size:17px;font-weight:650;letter-spacing:-.01em;margin:0 0 8px}
.fr .page p{font-size:14.5px;line-height:1.62;margin:0 0 8px;color:var(--ink)}
.fr .page .sample{background:var(--well);border-radius:8px;padding:8px 12px;color:var(--ink)}
.fr .page .sample span{display:block;font-size:11.5px;font-weight:600;color:var(--ink3);margin-bottom:1px}
.fr .slot{position:relative;display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:10px;border:1.5px dashed var(--primary);background:color-mix(in srgb,var(--selected) 55%,var(--panel))}
.fr .slot p{font-size:13.5px;line-height:1.5;margin:0}.fr .slot .rights{font-size:12px;color:var(--ink2);margin-top:6px}
.fr .slot .btn{margin-left:auto;align-self:center}
.fr .mk{position:absolute;top:-9px;right:-9px;width:20px;height:20px;border-radius:50%;background:var(--danger);color:var(--panel);font-size:11px;font-weight:700;display:grid;place-items:center}
.fr .ev{grid-row:2/4;grid-column:3;background:var(--panel);border:1px solid var(--hair);border-radius:12px;padding:12px 14px 12px;overflow:hidden;display:flex;flex-direction:column;gap:6px}
.fr .evhead{font-size:14px;font-weight:650;padding-bottom:8px;border-bottom:1px solid var(--hair)}
.fr .ev .cnt{display:flex;gap:10px;font-weight:600}.fr .ev .cnt span{display:inline-flex;align-items:center;gap:4px}.fr .bk{color:var(--danger)}.fr .av2{color:var(--warn)}
.fr .ic{border:1px solid var(--hair);border-radius:10px;padding:7px 10px;display:grid;gap:3px;font-size:13px;line-height:1.4}
.fr .ich{display:flex;gap:8px;align-items:flex-start}.fr .ich p{flex:1;padding-top:1px}.fr .ich .tag{margin-top:0}.fr .ino{font-size:11.5px;color:var(--ink3);font-weight:600}
.fr .ic .cd{justify-self:start;font-size:11px}
.fr .st-h{margin-top:4px}
.fr .stds td{padding:5px 4px;font-size:12.5px;vertical-align:top}.fr .stds td:first-child{width:62px;padding-left:0}
.fr .stds .src{display:block;color:var(--ink);font-weight:500}.fr .stds .tc{display:block;color:var(--ink2);font-size:12px;margin-top:2px}
.fr .stds .tag{height:20px;font-size:11.5px}
.fr .official{margin:0;background:var(--well);border-radius:8px;padding:9px 11px;font-size:12.3px;line-height:1.5;color:var(--ink)}
.fr .official span{display:block;font-size:11.5px;font-weight:600;color:var(--ink3);margin-bottom:3px}.fr .official .cd{background:var(--panel);font-size:10.5px}
.fr .foot{grid-column:1/3;display:flex;align-items:center;gap:14px;background:var(--panel);border:1px solid var(--hair);border-radius:12px;padding:10px 12px 10px 16px;font-size:12.5px}
.fr .foot .mut{display:inline-flex;align-items:center;gap:7px;color:var(--ink2)}
.fr .blkn{white-space:nowrap;display:inline-flex;align-items:center;gap:6px;color:var(--danger);font-weight:600;font-size:13px}
/* M4 */
.fr .m4{display:grid;grid-template-columns:minmax(0,1fr) 352px;grid-template-rows:auto minmax(0,1fr);gap:16px 22px;height:100%}
.fr .m4-sheet{padding:22px 28px;overflow:hidden}
.fr .m4-sheet .banner{margin-top:16px}
.fr .snap{display:inline-flex;align-items:center;gap:6px;color:var(--ink2)}
.fr .checks{list-style:none;margin:4px 0 0;padding:0}
.fr .checks li{display:flex;gap:12px;padding:11px 0;border-top:1px solid var(--hair)}.fr .checks li:first-child{border-top:0}
.fr .ck{color:var(--success);padding-top:1px}.fr .checks b{font-weight:600}.fr .checks p{color:var(--ink2);font-size:13px;margin-top:3px;line-height:1.55}
.fr .decide .card{display:flex;flex-direction:column;gap:12px;padding:18px}
.fr .quality{border:0;margin:2px 0 0;padding:0;display:grid;gap:6px}
.fr .quality legend{font-size:13px;font-weight:600;padding:0;margin-bottom:6px}.fr .quality legend em{font-style:normal;color:var(--ink3);font-weight:500}
.fr .quality label{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;background:var(--well);font-size:13px;color:var(--ink2)}
.fr .quality label.on{background:var(--selected);color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--primary)}
.fr .radio{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--edge);background:var(--panel);flex:none}
.fr .on .radio{border:5px solid var(--primary)}
.fr .decide .fine{display:flex;gap:6px;align-items:flex-start}.fr .decide .fine .i{margin-top:2px}
"""

PAGE_CSS = """
:root{color-scheme:light dark;--bg:#F4F5F7;--surface:#FFFFFF;--line:#E2E5EA;--text:#14171C;--muted:#4A5260;--accent:#1F4FD8;--soft:#EAF0FE}
@media (prefers-color-scheme:dark){:root{--bg:#0F1115;--surface:#171A20;--line:#2A2F38;--text:#ECEEF2;--muted:#A9B0BC;--accent:#8AA9FF;--soft:#1C2744}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 SANS;-webkit-font-smoothing:antialiased}
.page{max-width:1280px;margin:0 auto;padding:40px 16px 72px}
.badge{display:inline-flex;gap:8px;align-items:center;font-size:13px;font-weight:600;color:var(--accent);background:var(--soft);border-radius:6px;padding:3px 10px;margin:0}
h1{font-size:clamp(30px,4vw,44px);line-height:1.08;letter-spacing:-.025em;font-weight:700;margin:14px 0 10px}
.lede{font-size:19px;line-height:1.5;max-width:62ch;margin:0 0 8px;text-wrap:pretty}
.muted,.note{color:var(--muted)}.note{max-width:76ch;font-size:15px;text-wrap:pretty}
.glance{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:24px 0 0}
.glance div{background:var(--surface);padding:12px 14px}.glance b{display:block;font-size:12px;color:var(--muted);font-weight:600}.glance span{font-size:14px}
section.s{margin:56px 0 0}
h2.h{font-size:24px;letter-spacing:-.015em;margin:0 0 6px}
.mock{margin:28px 0 0}
.mock>h3{font-size:17px;margin:0 0 2px}.mock>p{margin:0 0 12px;color:var(--muted);font-size:14.5px;max-width:80ch}
.scroll{overflow-x:auto;padding:4px 4px 24px;-webkit-overflow-scrolling:touch}
.scroll .fr{margin:0}
.palettes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:16px}
.pal{border-radius:14px;padding:18px;border:1px solid var(--line)}.pal h3{margin:0 0 12px;font-size:17px}
.sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}
.sw{font-size:12px;display:flex;flex-direction:column;gap:1px;min-width:0}.sw span{height:40px;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(127,127,127,.28);margin-bottom:4px}
.sw code{font:11.5px MONO;opacity:.8}
.ct{border-collapse:collapse;width:100%;font-size:13px;margin-top:16px}
.ct th{text-align:left;font-size:12px;opacity:.75;font-weight:600;padding:4px 6px}
.ct td{padding:5px 6px;border-top:1px solid rgba(127,127,127,.25)}
.ct .chip{display:inline-grid;place-items:center;width:26px;height:20px;border-radius:5px;margin-right:8px;font-weight:700;font-size:11px;vertical-align:middle;box-shadow:inset 0 0 0 1px rgba(127,127,127,.3)}
.ct .chip i{width:12px;height:12px;border-radius:3px}
.num{font-variant-numeric:tabular-nums}
.tbl2{border-collapse:collapse;width:100%;font-size:14px;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.tbl2 th,.tbl2 td{text-align:left;padding:10px 14px;border-top:1px solid var(--line);vertical-align:top}.tbl2 th{border-top:0;font-size:12.5px;color:var(--muted)}
.wrapx{overflow-x:auto}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:18px}
.shot{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.shot img{width:100%;display:block;aspect-ratio:4/3;object-fit:cover;border-bottom:1px solid var(--line)}
.shot figcaption{padding:12px 14px 14px;font-size:13.5px;line-height:1.5}.shot figcaption b{font-weight:650}
.shot .why{display:block;margin-top:6px}.shot .feel,.shot .use{display:block;color:var(--muted);font-size:12.5px;margin-top:4px}
.shot a{color:var(--accent);word-break:break-all;font-size:12px}
.int{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
footer.f{margin-top:56px;padding-top:18px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}
code{font-family:MONO;font-size:.9em}
"""


def shots_html(uris):
    out = []
    for f, t, d, u, why, feel, use in SHOTS:
        out.append(f"<figure class='shot'><img src='{uris[f]}' alt='{html.escape(t)} by {html.escape(d)}'><figcaption>"
                   f"<span class='int'>Internal reference only · {f[:5]}</span><br><b>{html.escape(t)}</b> · {html.escape(d)}"
                   f"<span class='why'>{html.escape(why)}</span><span class='feel'>Feel-brief line: {feel}</span>"
                   f"<span class='use'>On this sheet: {use}</span><a href='{u}'>{u}</a></figcaption></figure>")
    return "".join(out)


def page():
    uris = data_uris()
    lt, dk = css_vars(LIGHT), css_vars(DARK)
    css = (PAGE_CSS + CSS).replace("SANS", SANS).replace("MONO", MONO)
    css += f".t-light{{{lt}}}.t-dark{{{dk}}}"
    glance = "".join(f"<div><b>{k}</b><span>{v}</span></div>" for k, v in GLANCE)
    mocks = "".join(f"<div class='mock'><h3>{h}</h3><p>{p}</p><div class='scroll t-light'>{m}</div></div>" for h, p, m in MOCKUPS)
    house = "".join(f"<tr><td>{a}</td><td>{b}</td><td>pass</td></tr>" for a, b in [
        ("Cream canvas", "No. Cool grey desk #F4F5F7 under a white page."),
        ("Serif headings", "No. Every heading is the grotesk stack; italics only for book titles."),
        ("Outlined pills", "No. Status tags are tinted fills with a glyph, 6 px radius; step dots are filled."),
        ("Sage accents", "No. Ink blue #1F4FD8 is the only accent; green appears only for approved and done."),
    ])
    lw = min(TEXT_PAIRS, key=lambda p: ratio(LIGHT[p[0]], LIGHT[p[1]]))
    dw = min(TEXT_PAIRS, key=lambda p: ratio(DARK[p[0]], DARK[p[1]]))
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>D1 Clear Ledger look sheet</title><style>{css}</style></head><body><main class="page">
<p class="badge">UX-2 · look sheet · status: proposal · {DATE}</p>
<h1>{DIRECTION} · {NAME}</h1>
<p class="lede">{INTENT}</p>
<p class="note">A static look; linked-screen prototypes come only for the directions you shortlist. Nothing below is clickable. The four screens and every word on them are the same on all four direction sheets (<code>docs/ux/02-concepts/LOOK_SHEET_COPY.md</code>); only the look changes. Names and numbers marked synthetic there are made up.</p>
<div class="glance">{glance}</div>

<section class="s"><h2 class="h">Four screens in light mode (the primary theme)</h2>
<p class="note">Drawn at desktop width, 1200 × 760. On a narrow window each frame scrolls sideways inside its own box. Construction: a white page sheet on a cool grey desk, the five-step stepper with filled dots, tinted banners with an icon tile, light-ruled tables, the Issues · Standards rail, ink blue for the one primary action. Status always carries a word and a shape: hollow circle draft, half circle in review, arrow submitted, check approved, triangle failed, octagon blocking.</p>
{mocks}</section>

<section class="s"><h2 class="h">M3 again, dark (secondary theme)</h2>
<p class="note">Same markup, dark tokens. Surfaces get lighter as they rise (desk #0F1115, sheet #171A20, wells #1E222A); shadows are dropped; the ink blue lifts to #8AA9FF with near-black text on it.</p>
<div class="mock"><h3>M3 · SCR-9 Lesson workspace, Lesson 4 · dark</h3><p>FLOW-7, WP-1.</p><div class="scroll t-dark">{M3_DARK}</div></div></section>

<section class="s"><h2 class="h">Palette (proposal; UX-3 makes it exact)</h2>
<p class="note">Ground, panel, well, ink, ink2 and primary are the D1 values in <code>DESIGN-DIRECTIONS.md</code>; the rest are added here. Contrast is computed from these hex values by the generator with the WCAG 2 formula, and the build stops if any text pair is under 4.5:1 or any meaningful UI part under 3:1. Lowest text pair: light <b>{lw[0]} on {lw[1]}</b> {ratio(LIGHT[lw[0]], LIGHT[lw[1]]):.2f}:1; dark <b>{dw[0]} on {dw[1]}</b> {ratio(DARK[dw[0]], DARK[dw[1]]):.2f}:1. Hairlines (<code>hair</code>) are decoration only; every control that needs an edge to be seen uses <code>edge</code>, and secondary buttons are identified by their label.</p>
<div class="palettes">
<div class="pal" style="background:{LIGHT['panel']};color:{LIGHT['ink']}"><h3>Light</h3><div class="sws">{swatches(LIGHT)}</div><div class="wrapx">{contrast_rows(LIGHT)}</div></div>
<div class="pal" style="background:{DARK['ground']};color:{DARK['ink']}"><h3>Dark</h3><div class="sws">{swatches(DARK)}</div><div class="wrapx">{contrast_rows(DARK)}</div></div>
</div></section>

<section class="s"><h2 class="h">House-texture check</h2>
<div class="wrapx"><table class="tbl2"><thead><tr><th>Texture</th><th>On this sheet</th><th>Result</th></tr></thead><tbody>{house}</tbody></table></div></section>

<section class="s"><h2 class="h">The six references behind D1</h2>
<p class="note">Other designers' published work from Dribbble, captured 2026-10-25 and credited in <code>docs/ux/02-concepts/REFERENCES.md</code>. Internal reference only: they are never copied into the product. Images are downscaled copies embedded in this file.</p>
<div class="shots">{shots_html(uris)}</div></section>

<footer class="f">Local file, not published. Rebuild: <code>python3 docs/artifacts/_build/d1-look/build_d1_look.py</code> (from the repo root).</footer>
</main></body></html>"""


if __name__ == "__main__":
    bad = failures()
    if bad:
        print("CONTRAST FAIL\n" + "\n".join(bad))
        sys.exit(1)
    OUT.write_text(page())
    print(OUT, f"{OUT.stat().st_size / 1e6:.2f} MB")
    for mode, pal in (("light", LIGHT), ("dark", DARK)):
        w = min(TEXT_PAIRS, key=lambda p: ratio(pal[p[0]], pal[p[1]]))
        u = min(UI_PAIRS, key=lambda p: ratio(pal[p[0]], pal[p[1]]))
        print(f"{mode}: lowest text pair {w[0]} on {w[1]} = {ratio(pal[w[0]], pal[w[1]]):.2f}:1; "
              f"lowest UI pair {u[0]} against {u[1]} = {ratio(pal[u[0]], pal[u[1]]):.2f}:1")
