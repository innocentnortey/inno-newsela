"""Starter generator for a UX-2 look sheet (templates/LOOK_SHEET.md). Copy, fill the FILL blocks, run.

Copy to:  docs/artifacts/_build/<direction>-look/build_<direction>_look.py
Run:      python3 docs/artifacts/_build/<direction>-look/build_<direction>_look.py
Writes:   docs/artifacts/YYYY-MM-DD-<direction>-look-sheet.html (static, offline, images embedded)

Distilled from inno-aea-callcenter/docs/artifacts/_build/a4-look/build_a4_look.py (2026-10-20).
Palette values are a proposal for review; UX-3b design.md makes them exact. Exit 1 if a text pair fails AA.
"""
import base64
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
DOCS = HERE.parents[2]  # docs/  (this file sits in docs/artifacts/_build/<direction>-look/)
REFS = DOCS / "design" / "references"

# FILL 1: identity
DIRECTION = "A1"
NAME = "Direction name"
INTENT = "One line: what this direction feels like and why."
DATE = "YYYY-MM-DD"
OUT = DOCS / "artifacts" / f"{DATE}-{DIRECTION.lower()}-look-sheet.html"

# FILL 2: credited references (file in docs/design/references/, title, designer, shot URL, why kept)
SHOTS = [
    # ("dr-01-example.jpg", "Shot title", "Designer", "https://dribbble.com/shots/...", "What we take from it"),
]

# FILL 3: palettes (light is primary). Keys are used as CSS variables by the mockups below.
LIGHT = {"ground": "#F5F2EC", "panel": "#FFFFFF", "well": "#EDF1F4", "selected": "#DCE5EC",
         "ink": "#1E2A33", "ink2": "#56626C", "ink3": "#8A949C", "primary": "#2E5E7E",
         "on-primary": "#FFFFFF", "danger": "#B42318", "on-danger": "#FFFFFF"}
DARK = {"ground": "#161E26", "panel": "#1E2832", "well": "#26323E", "selected": "#30404F",
        "ink": "#ECEFF2", "ink2": "#AAB5BE", "ink3": "#7B8792", "primary": "#8DB4D2",
        "on-primary": "#10202C", "danger": "#C8312F", "on-danger": "#FFFFFF"}
# Text pairs (fg, bg) that must reach 4.5:1. ink3 is for captions on large/UI parts only, so not listed.
PAIRS = [("ink", "ground"), ("ink", "panel"), ("ink", "well"), ("ink2", "panel"), ("ink2", "well"),
         ("ink2", "ground"), ("on-primary", "primary"), ("on-danger", "danger")]

# FILL 4: 3-4 static mockups of the core screens, on REAL flow copy (USER_FLOWS.md) and synthetic data.
# Use the same screens and copy on every direction's sheet; change only CSS below. No JS, no handlers.
MOCKUPS = [
    """<div class="phone"><div class="topbar"><b>Product name</b><span>Screen title</span></div>
<div class="body"><p class="cap">Speaker · 2:03 pm</p><p>Real sentence from the flow.</p>
<div class="panel"><h3>Panel heading</h3><div class="row"><span>Label</span><b class="num">$89</b></div>
<button class="pri">Primary action from the flow</button></div></div></div>""",
]
DARK_MOCKUP = 0  # index of the mockup repeated on the dark palette

# Direction CSS: the component construction lives here. Mockups read colours only from var(--key).
CSS = """
.phone{width:360px;max-width:100%;background:var(--ground);color:var(--ink);border-radius:28px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,.12);min-height:640px}
.topbar{background:var(--panel);padding:14px 16px;display:flex;flex-direction:column}.topbar span{font-size:13px;color:var(--ink2)}
.body{padding:12px 14px}.cap{font-size:12px;color:var(--ink2);margin:12px 0 4px}
.panel{background:var(--panel);border-radius:20px;padding:16px;margin:8px 0}.panel h3{margin:0 0 10px;font-size:18px}
.row{display:flex;justify-content:space-between;padding:8px 0;font-size:15px}.row span{color:var(--ink2)}
.pri{margin-top:12px;width:100%;height:48px;border:0;border-radius:12px;background:var(--primary);color:var(--on-primary);font-weight:600;font-size:16px;font-family:inherit}
"""

FONTS = ""  # optional: a Google Fonts <link>; keep a system fallback in CSS so the page reads offline

# ---- no edits needed below ----

def lum(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def verdict(r):
    return "AA" if r >= 4.5 else ("AA large / UI only" if r >= 3 else "FAIL")


def contrast_table(pal):
    rows = "".join(f"<tr><td>{fg} on {bg}</td><td class='num'>{ratio(pal[fg], pal[bg]):.2f}:1</td>"
                   f"<td>{verdict(ratio(pal[fg], pal[bg]))}</td></tr>" for fg, bg in PAIRS)
    return f"<table>{rows}</table>"


def swatches(pal):
    return "".join(f"<div class='sw'><span style='background:{v}'></span><b>{k}</b><code>{v}</code></div>"
                   for k, v in pal.items())


def css_vars(pal):
    return ";".join(f"--{k}:{v}" for k, v in pal.items())


def data_uri(name):
    p = REFS / name
    mime = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(p.read_bytes()).decode()}"


def shots_html():
    return "".join(f"<figure class='shot'><img src='{data_uri(f)}' alt='{t} by {d}'><figcaption><b>{t}</b> · {d}<br>"
                   f"<span class='muted'>{why}</span><br><a href='{u}'>{u}</a></figcaption></figure>"
                   for f, t, d, u, why in SHOTS)


PAGE_CSS = """*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;background:#F4F4F2;color:#1F2328}
.page{max-width:1240px;margin:0 auto;padding:24px 16px 64px}h1{font-size:28px;margin:0 0 4px}.lede,.muted,.note{color:#57606A}
section{margin:32px 0}.badge{display:inline-block;background:#E6E8EB;border-radius:6px;padding:2px 8px;font-size:13px}
.mocks{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
.palettes{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}.pal{border-radius:16px;padding:16px}
.sws{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.sw{font-size:12px;display:flex;flex-direction:column}
.sw span{height:40px;border-radius:10px;box-shadow:inset 0 0 0 1px rgba(127,127,127,.2)}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:12px}td{padding:3px 6px;border-top:1px solid rgba(127,127,127,.25)}
.num{font-variant-numeric:tabular-nums}.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.shot{margin:0;background:#fff;border-radius:14px;overflow:hidden}.shot img{width:100%;display:block}.shot figcaption{padding:10px;font-size:13px}
.shot a{word-break:break-all;font-size:12px}"""


def page():
    lt, dk = css_vars(LIGHT), css_vars(DARK)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{DIRECTION} Look Sheet</title>{FONTS}<style>{PAGE_CSS}{CSS}</style></head><body><main class="page">
<p class="badge">UX-2 · look sheet · proposal · {DATE}</p><h1>{DIRECTION} · {NAME}</h1>
<p class="lede">{INTENT} Static screens so you can judge the colours and feel; nothing is clickable. The frontend is built later, in the picked direction.</p>
<section><h2>Mockups, light (primary theme)</h2><div class="mocks" style="{lt}">{''.join(MOCKUPS)}</div></section>
<section><h2>The same, dark</h2><div class="mocks" style="{dk}">{MOCKUPS[DARK_MOCKUP]}</div></section>
<section><h2>Palette (proposal; UX-3b makes it exact)</h2><p class="note">Contrast is computed from these hex values.</p><div class="palettes">
<div class="pal" style="background:{LIGHT['ground']};color:{LIGHT['ink']}"><h3>Light</h3><div class="sws">{swatches(LIGHT)}</div>{contrast_table(LIGHT)}</div>
<div class="pal" style="background:{DARK['ground']};color:{DARK['ink']}"><h3>Dark</h3><div class="sws">{swatches(DARK)}</div>{contrast_table(DARK)}</div></div></section>
<section><h2>References behind {DIRECTION}</h2><p class="note">Other designers' published work, internal reference only.</p><div class="shots">{shots_html()}</div></section>
<p class="note">Local file, not published. Rebuild: <code>python3 {HERE.relative_to(DOCS.parent)}/{pathlib.Path(__file__).name}</code></p>
</main></body></html>"""


if __name__ == "__main__":
    OUT.write_text(page())
    print(OUT, f"{OUT.stat().st_size / 1e6:.2f} MB")
    failed = False
    for mode, pal in (("light", LIGHT), ("dark", DARK)):
        worst = min(PAIRS, key=lambda p: ratio(pal[p[0]], pal[p[1]]))
        r = ratio(pal[worst[0]], pal[worst[1]])
        print(f"{mode}: lowest text pair {worst[0]} on {worst[1]} = {r:.2f}:1 ({verdict(r)})")
        failed |= r < 4.5
    sys.exit(1 if failed else 0)
