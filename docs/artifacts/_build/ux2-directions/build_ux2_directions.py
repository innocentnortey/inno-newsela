"""Build the UX-2 shortlist page: the four directions side by side (docs/artifacts/2026-10-25-ux-2-directions.html).

Images: crops of each look sheet's M3 (Lesson 4 workspace), made from headless-Chrome screenshots and passed as
argv[1] (a folder holding m3-<direction>.jpg). Run from the repo root:
  python3 docs/artifacts/_build/ux2-directions/build_ux2_directions.py <crop-folder>
"""
import base64, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[4]
SKILL = ROOT.parent / ".claude/skills/zero-to-hero/templates/visual-review-page.html"
CROPS = pathlib.Path(sys.argv[1])
OUT = ROOT / "docs/artifacts/2026-10-25-ux-2-directions.html"
css = re.search(r"<style>(.*?)</style>", SKILL.read_text(), re.S).group(1)

def img(name):
    return "data:image/jpeg;base64," + base64.b64encode((CROPS / f"m3-{name}.jpg").read_bytes()).decode()

D = [
 ("d1-clear-ledger", "D1 · Clear Ledger", "The lesson is a document on a desk; the tool is a quiet editor's frame around it.",
  "Light · cool white · ink blue", "Medium corners, hairlines", "Airy", "Page sheet, status stepper, right rail",
  "Best fit for long, careful reading and for showing evidence beside the text. Feels like a premium document tool.",
  "Can look plain if the evidence rail is empty; the stepper takes vertical space."),
 ("d2-night-desk", "D2 · Night Desk", "A focused workbench for experts who live in it all day.",
  "Dark first · graphite · signal green", "Hard corners, no shadows", "Dense", "Grouped rows, tabs, mono IDs",
  "Fastest to scan; feels like the premium tools engineers love. Approve-a-version reads like code review.",
  "Dark reading of ~3,300-word lessons tires some readers; teachers may find it cold."),
 ("d3-soft-studio", "D3 · Soft Studio", "A friendly team space that makes review feel shared.",
  "Light · periwinkle wash · indigo", "Very soft, pills, soft shadows", "Airy", "Cards, three panes",
  "Warmest and most welcoming; review feels like teamwork, which speaks to reviewers wary of AI.",
  "Least dense: the 47-row tables need more scrolling. Its rounded font shows fully in Safari only."),
 ("d4-warm-workroom", "D4 · Warm Workroom", "A well-run workshop: the numbers and the trail are always visible.",
  "Light · white canvas · walnut and terracotta", "Firm corners, ruled tables", "Dense", "Tables, banded headers, approval timeline",
  "Most accountable: import errors, counts and the approval trail are always in view. Warm without being cream.",
  "The walnut sidebar is a strong flavour; dense tables can feel administrative."),
]

cards = []
for slug, name, idea, temp, soft, dens, shape, good, bad in D:
    cards.append(f"""<article class="card dir" data-status="proposal">
  <h3>{name} <span class="st proposal">Proposal</span></h3>
  <p class="idea">{idea}</p>
  <a class="shot" href="2026-10-25-{slug}-look-sheet.html"><img src="{img(slug)}" alt="{name}: the Lesson 4 workspace mockup, light theme" loading="lazy"></a>
  <table class="traits"><tr><th scope="row">Theme</th><td>{temp}</td></tr><tr><th scope="row">Softness</th><td>{soft}</td></tr><tr><th scope="row">Density</th><td>{dens}</td></tr><tr><th scope="row">Shapes</th><td>{shape}</td></tr></table>
  <p><strong>Good at:</strong> {good}</p>
  <p><strong>Watch out:</strong> {bad}</p>
  <p class="src"><a href="2026-10-25-{slug}-look-sheet.html">Open the full look sheet</a>: four screens, the other theme, palette with computed contrast, credited references.</p>
</article>""")

flow = """<svg viewBox="0 0 1040 150" role="img" aria-labelledby="ft fd"><title id="ft">How the four directions were made</title>
<desc id="fd">Feel brief, then searches by feel and pattern, then four directions, then a look sheet each, then your shortlist, then linked-screen prototypes, then your pick.</desc>
<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="head" d="M0,0 L10,5 L0,10 z"/></marker></defs>
<rect class="node fact" x="10" y="40" width="140" height="62" rx="8"/><text x="22" y="66" class="strong">Feel brief</text><text x="22" y="85" class="small">calm, editorial, expert</text>
<rect class="node fact" x="180" y="40" width="140" height="62" rx="8"/><text x="192" y="66" class="strong">16 searches</text><text x="192" y="85" class="small">371 shots, no "edtech"</text>
<rect class="node fact" x="350" y="40" width="140" height="62" rx="8"/><text x="362" y="66" class="strong">4 directions</text><text x="362" y="85" class="small">differ at a glance</text>
<rect class="node fact" x="520" y="40" width="140" height="62" rx="8"/><text x="532" y="66" class="strong">4 look sheets</text><text x="532" y="85" class="small">same screens, same copy</text>
<rect class="node awaiting" x="690" y="40" width="150" height="62" rx="8"/><text x="702" y="66" class="strong">You shortlist</text><text x="702" y="85" class="small">up to 3 (this page)</text>
<rect class="node proposal" x="870" y="40" width="160" height="62" rx="8"/><text x="882" y="66" class="strong">Linked prototypes</text><text x="882" y="85" class="small">then you pick one</text>
<path class="arrow" d="M150,71 L180,71" marker-end="url(#ah)"/><path class="arrow" d="M320,71 L350,71" marker-end="url(#ah)"/>
<path class="arrow" d="M490,71 L520,71" marker-end="url(#ah)"/><path class="arrow" d="M660,71 L690,71" marker-end="url(#ah)"/>
<path class="arrow dash" d="M840,71 L870,71" marker-end="url(#ah)"/></svg>"""


mapsvg = """<svg viewBox="0 0 640 380" role="img" aria-labelledby="mt md"><title id="mt">Where the four directions sit</title>
<desc id="md">A map with density across (airy left, dense right) and softness up and down (soft top, hard bottom). D3 Soft Studio is soft and airy. D1 Clear Ledger is medium and airy. D4 Warm Workroom is firm and dense. D2 Night Desk is hard and dense, and the only dark one.</desc>
<rect class="lane-assistant" x="60" y="20" width="560" height="320" rx="8"/>
<path class="arrow" d="M60,340 L620,340"/><path class="arrow" d="M60,340 L60,20"/>
<text x="64" y="364" class="small">airy</text><text x="580" y="364" class="small">dense</text>
<text x="8" y="36" class="small">soft</text><text x="8" y="336" class="small">hard</text>
<circle class="node proposal" cx="160" cy="80" r="30"/><text x="200" y="76" class="strong">D3 Soft Studio</text><text x="200" y="94" class="small">light, periwinkle</text>
<circle class="node proposal" cx="210" cy="200" r="30"/><text x="250" y="196" class="strong">D1 Clear Ledger</text><text x="250" y="214" class="small">light, cool white</text>
<circle class="node proposal" cx="470" cy="240" r="30"/><text x="430" y="236" class="strong" text-anchor="end">D4 Warm Workroom</text><text x="430" y="254" class="small" text-anchor="end">light, walnut + terracotta</text>
<circle class="node awaiting" cx="560" cy="300" r="30"/><text x="440" y="56" class="strong">D2 Night Desk</text><text x="440" y="74" class="small">the only dark one</text>
<path class="arrow dash" d="M530,80 L555,268"/></svg>"""

extra = """
.dirs{display:grid;gap:var(--space-3);grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr))}
.dir .idea{font:17px/1.5 var(--font-ui);color:var(--muted)}
.shot{display:block;border-radius:8px;overflow:hidden;border:1px solid var(--line);margin:var(--space-2) 0}
.shot img{display:block;width:100%;height:auto}
.traits{margin:var(--space-2) 0;font-size:14px}.traits th{width:7.5em;background:none;color:var(--muted)}
.part[data-part="why-asked"]{border-left-color:var(--proposal)}
.rec{background:var(--proposal-bg);border-radius:8px;padding:var(--space-2) var(--space-3);margin-top:var(--space-2)}
"""

html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Newsela Lesson Studio — UX-2 directions</title>
<meta name="review-stage" content="UX pipeline UX-2 · Concepts (shortlist)">
<meta name="review-status" content="DRAFT — not decided; awaiting Innocent's shortlist">
<meta name="review-date" content="2026-10-25">
<meta name="review-source" content="docs/ux/02-concepts/FEEL_BRIEF.md|0">
<meta name="review-source" content="docs/design/DESIGN-DIRECTIONS.md|0">
<meta name="review-source" content="docs/ux/02-concepts/REFERENCES.md|0">
<meta name="review-source" content="docs/ux/02-concepts/LOOK_SHEET_COPY.md|0">
<style>{css}{extra}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
<p class="kicker">UX-2 · Concepts · choose the shortlist · local file · Markdown is the source of truth</p>
<h1>Newsela Lesson Studio — four ways it could look</h1>
<div class="status-banner" role="status"><span class="st awaiting">Awaiting your shortlist</span>
<div><strong>DRAFT — nothing is decided.</strong> Four directions, each with a full look sheet. You are asked to shortlist up to three (or pick one). Only the shortlisted ones get linked-screen prototypes.</div></div>
<dl class="meta">
<dt>Review date</dt><dd>2026-10-25</dd>
<dt>Sources</dt>
<dd><a href="../ux/02-concepts/FEEL_BRIEF.md"><code>docs/ux/02-concepts/FEEL_BRIEF.md</code></a> — what it must feel like, and the search terms · SHA-256 <code data-sha-for="docs/ux/02-concepts/FEEL_BRIEF.md">0</code></dd>
<dd><a href="../design/DESIGN-DIRECTIONS.md"><code>docs/design/DESIGN-DIRECTIONS.md</code></a> — the four directions, their construction and palettes · SHA-256 <code data-sha-for="docs/design/DESIGN-DIRECTIONS.md">0</code></dd>
<dd><a href="../ux/02-concepts/REFERENCES.md"><code>docs/ux/02-concepts/REFERENCES.md</code></a> — 24 credited references · SHA-256 <code data-sha-for="docs/ux/02-concepts/REFERENCES.md">0</code></dd>
<dd><a href="../ux/02-concepts/LOOK_SHEET_COPY.md"><code>docs/ux/02-concepts/LOOK_SHEET_COPY.md</code></a> — the shared screen copy · SHA-256 <code data-sha-for="docs/ux/02-concepts/LOOK_SHEET_COPY.md">0</code></dd>
<dt>Refresh</dt><dd>If a source changes, this page is rebuilt and re-checked before you are asked again.</dd>
</dl>
<ul class="legend" data-legend aria-label="Status legend">
<li><span class="st fact" data-legend-item="fact">Fact</span> established; a source is cited</li>
<li><span class="st decision" data-legend-item="decision">Your decision</span> decided by you, with date</li>
<li><span class="st proposal" data-legend-item="proposal">Proposal</span> Claude proposes; not decided</li>
<li><span class="st unknown" data-legend-item="unknown">Unknown</span> not established</li>
<li><span class="st awaiting" data-legend-item="awaiting">Awaiting approval</span> asked of you now</li>
</ul></div></header>
<main id="main" class="wrap">

<section aria-labelledby="sum-h" data-visual="summary"><h2 id="sum-h">At a glance</h2>
<div class="grid">
<article class="card" data-status="fact"><h3>The method <span class="st fact">Fact</span></h3><p class="big">Searched by feel, not by "education"</p><p>16 searches for the feel and the screen shapes, 371 shots. Almost no dated ed-tech came back.</p><p class="src">FEEL_BRIEF.md; REFERENCES.md</p></article>
<article class="card" data-status="fact"><h3>The options <span class="st fact">Fact</span></h3><p class="big">4 directions, 4 look sheets</p><p>Same four screens and the same words on every sheet, so only the look changes.</p><p class="src">LOOK_SHEET_COPY.md</p></article>
<article class="card" data-status="proposal"><h3>My recommendation <span class="st proposal">Proposal</span></h3><p class="big">Shortlist D1, D4 and D2</p><p>D1 Clear Ledger first. Reasons below.</p><p class="src">Your shortlist settles it.</p></article>
</div></section>

<section aria-labelledby="story-h" data-visual="story"><h2 id="story-h">The story so far</h2>
<p class="lede">Newsela's reviewers will spend long days in this tool, reading one 50-minute lesson at a time, fixing it, and approving it. So it has to feel calm, editorial, expert, warm and accountable. Those five words come from the feel brief.</p>
<p>Searching "education dashboard" would have shown what school software looks like today, which is often dated. So we searched for the feel and the screen shapes instead, in tools that already do them well: document review, code review, calm issue trackers, data imports. Four families stood out. Each became a direction with its own look sheet.</p>
<figure><p class="scroll-hint">Diagram: swipe sideways. The list below says the same.</p><div class="scroll" tabindex="0" aria-label="Diagram, scrolls sideways">{flow}</div>
<figcaption><span class="st fact">Fact</span> ux-pipeline UX-2, as changed on 2026-10-25.</figcaption>
<ol class="words"><li>Feel brief.</li><li>16 searches by feel and pattern.</li><li>Four directions.</li><li>A look sheet each.</li><li>You shortlist up to three.</li><li>Linked-screen prototypes, then you pick one.</li></ol></figure>
</section>

<section aria-labelledby="map-h"><h2 id="map-h">Where each one sits</h2>
<p class="section-sub">The four were chosen to sit far apart, so the choice is real. Two of them are light and cool (D1, D3), so they separate on softness and shape.</p>
<figure><p class="scroll-hint">Diagram: swipe sideways. The list below says the same.</p><div class="scroll" tabindex="0" aria-label="Map of the directions, scrolls sideways">{mapsvg}</div>
<figcaption><span class="st fact">Fact</span> At-a-glance values from DESIGN-DIRECTIONS.md.</figcaption>
<ol class="words"><li>D3 Soft Studio: very soft, airy, light periwinkle.</li><li>D1 Clear Ledger: medium softness, airy, light cool white.</li><li>D4 Warm Workroom: firm, dense, light with a walnut sidebar.</li><li>D2 Night Desk: hard, dense, the only dark direction.</li></ol></figure></section>
<section aria-labelledby="dirs-h"><h2 id="dirs-h">The four directions</h2>
<p class="section-sub">Each picture is the same screen: Lesson 4's workspace, with its three blocking issues. Click a picture for the full look sheet.</p>
<div class="dirs">{''.join(cards)}</div></section>

<section aria-labelledby="ask-h">
<article class="askcard card" data-status="awaiting" data-ask="UX2-SHORTLIST">
<h2 id="ask-h">Your shortlist <span class="st awaiting">Recommend: D1, D4, D2</span></h2>
<div class="part" data-part="context"><h3>Where this comes up in the project</h3><p>Every screen we build next uses one of these looks: the validation report, the unit board, the lesson workspace and the approval screen. The look you choose also shapes how the demo video feels to Newsela.</p></div>
<div class="part" data-part="problem"><h3>The problem</h3><p>Which directions deserve a clickable prototype? Each one you shortlist gets linked screens you can click through. Then you pick one.</p></div>
<div class="part" data-part="why-hard"><h3>Why it's hard</h3><p>All four fit the feel brief, in different ways. A dark tool is fast to scan but tiring to read in. A soft tool is welcoming but less dense. A look is easier to judge by clicking than by reading.</p></div>
<div class="part" data-part="why-asked"><h3>Why we're asking you</h3><p>Taste is yours, and it's cheap to keep three alive now: each linked prototype takes under an hour. Picking too early is what cost hours on the earlier project.</p></div>
<div class="rec"><span class="st proposal">Proposal</span> Shortlist <strong>D1 Clear Ledger</strong> (best fit for long reading with evidence beside it), <strong>D4 Warm Workroom</strong> (most accountable, warm without cream) and <strong>D2 Night Desk</strong> (the strongest contrast, to test whether you want dark). My first choice is D1. You can also pick one outright, or ask for a fifth direction.</div>
</article>
<div class="ask" data-status="awaiting" style="margin-top:16px"><p><span class="st awaiting">Awaiting your shortlist</span> <strong>UX-2 shortlist:</strong> which of D1–D4 get linked-screen prototypes. Choosing does not lock a final design: the pick comes after you click through them, and UX-3 makes the colours exact.</p></div>
</section>
</main>
<footer class="wrap">Local file, not published. The Markdown sources are the source of truth; this page is a synthesis built after them. If a source changes, the page is rebuilt and checked with the zero-to-hero <code>check_review_page.py</code> before you are asked again.</footer>
</body></html>"""
OUT.write_text(html)
print(OUT, len(html))
