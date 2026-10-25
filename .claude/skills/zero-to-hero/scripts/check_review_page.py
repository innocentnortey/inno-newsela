"""Check a zero-to-hero visual review page (Stages 1–3 and 6) against references/visual-review-pages.md.

Usage:
  python3 scripts/check_review_page.py <page.html> [--root <project-root>]

<project-root> is where the `review-source` paths are relative to (default: the nearest parent
of the page that contains PROJECT-CHECKLIST.md). Exit 1 on any FAIL. WARN lines need a human look.

What it cannot judge — do these by eye: whether a visual matches its source, whether an open
choice *looks* decided, and how the page reads at laptop width, phone width and in print.
"""

import argparse
import hashlib
import html
import re
import sys
from pathlib import Path

STATUSES = ("fact", "decision", "proposal", "unknown", "awaiting")
FINAL_WORDS = re.compile(r"\b(approved|final|decided|confirmed|signed off)\b", re.I)
NEGATION = re.compile(r"(not|un|awaiting|pending|before|until|no|never|isn't|aren't|once|if|when|only after)\W+(\w+\W+){0,3}$", re.I)


def find_root(page: Path) -> Path:
    for p in [page.parent, *page.parents]:
        if (p / "PROJECT-CHECKLIST.md").exists():
            return p
    return page.parent


def text_of(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def status_blocks(doc: str):
    """Yield (status, inner text) for each element carrying data-status (outermost content)."""
    for m in re.finditer(r'<(\w+)[^>]*\bdata-status="(\w+)"[^>]*>', doc):
        tag, status, start = m.group(1), m.group(2), m.end()
        depth, i = 1, start
        pat = re.compile(rf"<(/?){tag}\b[^>]*>", re.I)
        for t in pat.finditer(doc, start):
            depth += -1 if t.group(1) else 1
            if depth == 0:
                i = t.start()
                break
        yield status, text_of(doc[start:i])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("page")
    ap.add_argument("--root")
    a = ap.parse_args()
    page = Path(a.page).resolve()
    root = Path(a.root).resolve() if a.root else find_root(page)
    doc = page.read_text()
    fails, warns = [], []

    def need(cond, msg):
        if not cond:
            fails.append(msg)

    # 1 basics
    need(re.match(r"\s*<!doctype html>", doc, re.I), "missing <!doctype html>")
    need(re.search(r'<html[^>]*\blang="[a-z-]+"', doc, re.I), "missing <html lang>")
    need('name="viewport"' in doc, "missing viewport meta")
    need(re.search(r"<title>[^<]+</title>", doc), "missing <title>")
    need("<main" in doc, "missing <main> landmark")
    need(re.search(r'class="[^"]*\bskip\b', doc), "missing skip link")
    need("@media print" in doc, "missing @media print styles")
    need("prefers-color-scheme" in doc, "missing dark theme (prefers-color-scheme)")
    need("prefers-reduced-motion" in doc, "missing prefers-reduced-motion handling")

    # 2 no external assets
    ext = re.findall(r'<(?:script|img|link|iframe|video|audio|source)[^>]*\b(?:src|href)="(https?:)?//', doc, re.I)
    ext += re.findall(r"url\(\s*['\"]?https?://", doc, re.I) + re.findall(r"@import\s+url", doc, re.I)
    need(not ext, f"external assets referenced ({len(ext)})")

    # 3 plain-dump detection
    need(not re.search(r'name="generator"\s+content="pandoc', doc, re.I), "plain dump: pandoc generator tag")
    statuses = re.findall(r'\bdata-status="(\w+)"', doc)
    bad = sorted({s for s in statuses if s not in STATUSES})
    need(statuses, "plain dump: no data-status items (facts/decisions/proposals/unknowns/awaiting not separated)")
    need(not bad, f"unknown data-status values: {bad}")
    need(re.search(r'data-visual="summary"', doc), 'no visual summary (element with data-visual="summary")')
    for s in STATUSES:
        need(re.search(rf'data-legend[^>]*>.*?\b{s}\b', doc, re.S | re.I) or re.search(rf'data-legend-item="{s}"', doc),
             f"status legend lacks '{s}'")
    need("awaiting" in statuses, "no 'awaiting' item: the page states no approval request")

    # 4 diagrams
    svgs = re.findall(r"<svg\b[^>]*>.*?</svg>", doc, re.S)
    if not svgs and "data-no-diagram-reason" not in doc:
        fails.append("no inline SVG diagram (add one, or data-no-diagram-reason with a reason)")
    for i, svg in enumerate(svgs, 1):
        if 'role="img"' not in svg or "<title" not in svg:
            fails.append(f"svg #{i} lacks role=\"img\" and/or <title>")

    # 5 metadata, sources, staleness, links
    for key in ("review-stage", "review-status", "review-date"):
        need(re.search(rf'<meta name="{key}" content="[^"]+"', doc), f"missing <meta name=\"{key}\">")
    st = re.search(r'<meta name="review-status" content="([^"]+)"', doc)
    if st and re.search(r"\bapproved\b", st.group(1), re.I) and not re.search(r"\bnot approved\b", st.group(1), re.I):
        need(re.search(r'<meta name="review-approved-by" content="[^"]+✓ \d{4}-\d{2}-\d{2}', doc),
             "status says approved but no review-approved-by record (Innocent ✓ date)")
    sources = re.findall(r'<meta name="review-source" content="([^"|]+)\|([0-9a-f]{64})"', doc)
    need(sources, "no review-source metadata (path|sha256)")
    hrefs = {html.unescape(h).split("#")[0] for h in re.findall(r'href="([^"]+)"', doc)}
    resolved = {(page.parent / h).resolve() for h in hrefs if not re.match(r"^(https?:|mailto:|#)", h)}
    for path, digest in sources:
        f = root / path
        if not f.exists():
            fails.append(f"source missing on disk: {path}")
            continue
        if hashlib.sha256(f.read_bytes()).hexdigest() != digest:
            fails.append(f"STALE: {path} changed since the page was built")
        if f.resolve() not in resolved:
            fails.append(f"no direct link to source {path}")

    # 6 finality language in non-decided items
    for status, txt in status_blocks(doc):
        if status in ("proposal", "unknown", "awaiting"):
            for m in FINAL_WORDS.finditer(txt):
                if not NEGATION.search(txt[max(0, m.start() - 40):m.start()]):
                    fails.append(f"finality word '{m.group(1)}' inside a {status} item: …{txt[max(0, m.start()-50):m.end()+20]}…")
                    break

    # 7 context before content (added 2026-10-19): the story so far, and per hard-problem card the
    #   three parts, in order, before its options
    stage = re.search(r'<meta name="review-stage" content="([^"]+)"', doc)
    is_stage3 = bool(stage and re.search(r"Stage 3\b", stage.group(1)))
    is_stage6 = bool(stage and re.search(r"Stage 6\b", stage.group(1)))
    if 'data-visual="story"' not in doc:
        (fails if (is_stage3 or is_stage6) else warns).append('no "story so far" section (element with data-visual="story")')
    parts = ("context", "problem", "why-hard")
    cards = list(re.finditer(r'<(\w+)[^>]*\bdata-hp="([^"]+)"[^>]*>', doc))
    if is_stage3 and not cards:
        fails.append('Stage 3 page has no hard-problem cards marked data-hp="HP-N"')
    for m in cards:
        tag, hp, start = m.group(1), m.group(2), m.end()
        depth, end = 1, len(doc)
        for t in re.finditer(rf"<(/?){tag}\b[^>]*>", doc[start:]):
            depth += -1 if t.group(1) else 1
            if depth == 0:
                end = start + t.start()
                break
        body = doc[start:end]
        found = [p for p in parts if re.search(rf'data-part="{p}"', body)]
        missing = [p for p in parts if p not in found]
        if missing:
            fails.append(f"{hp}: missing story part(s) {missing} (context → problem → why-hard)")
        elif [p for p in re.findall(r'data-part="(context|problem|why-hard)"', body)][:3] != list(parts):
            fails.append(f"{hp}: story parts out of order (context → problem → why-hard)")
        else:
            for p in parts:
                pm = re.search(rf'<(\w+)[^>]*data-part="{p}"[^>]*>(.*?)</\1>', body, re.S)
                if pm and len(text_of(pm.group(2))) < 60:
                    fails.append(f"{hp}: '{p}' part is too thin to give context ({len(text_of(pm.group(2)))} chars)")

    # 8 decision items say why they are asked (1.5.0): context -> problem -> why-hard -> why-asked
    ask_parts = ("context", "problem", "why-hard", "why-asked")
    for m in re.finditer(r'<(\w+)[^>]*\bdata-ask="([^"]+)"[^>]*>', doc):
        tag, ask, start = m.group(1), m.group(2), m.end()
        depth, end = 1, len(doc)
        for tt in re.finditer(rf"<(/?){tag}\b[^>]*>", doc[start:]):
            depth += -1 if tt.group(1) else 1
            if depth == 0:
                end = start + tt.start()
                break
        body = doc[start:end]
        order = re.findall(r'data-part="(context|problem|why-hard|why-asked)"', body)
        missing = [q for q in ask_parts if q not in order]
        if missing:
            fails.append(f"{ask}: decision item missing part(s) {missing} (context → problem → why-hard → why-asked)")
        elif [q for q in order if q in ask_parts][:4] != list(ask_parts):
            fails.append(f"{ask}: decision item parts out of order (context → problem → why-hard → why-asked)")
        else:
            for q in ask_parts:
                pm = re.search(rf'<(\w+)[^>]*data-part="{q}"[^>]*>(.*?)</\1>', body, re.S)
                if pm and len(text_of(pm.group(2))) < 60:
                    fails.append(f"{ask}: '{q}' part is too thin to explain anything ({len(text_of(pm.group(2)))} chars)")

    # 9 reading level (1.5.0): Flesch-Kincaid grade over paragraph and list prose; a warning only
    prose = " ".join(text_of(x) for x in re.findall(r"<(?:p|li)\b[^>]*>(.*?)</(?:p|li)>", re.sub(r"<svg\b.*?</svg>", "", doc, flags=re.S), re.S))
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", prose) if len(s.split()) >= 3]
    wordlist = re.findall(r"[A-Za-z]+", prose)
    if sentences and wordlist:
        def syl(w):
            w = w.lower()
            n = len(re.findall(r"[aeiouy]+", w)) - (1 if w.endswith("e") and not w.endswith("le") else 0)
            return max(n, 1)
        grade = 0.39 * len(wordlist) / len(sentences) + 11.8 * sum(map(syl, wordlist)) / len(wordlist) - 15.59
        if grade > 9:
            warns.append(f"prose reads at about grade {grade:.1f} (Flesch-Kincaid); aim near grade 5-8: shorter sentences, plainer words, explain terms in place")

    # 10 soft signals
    words = len(text_of(re.sub(r"<style.*?</style>", "", doc, flags=re.S)).split())
    if words > (15000 if is_stage6 else 6000):
        warns.append(f"{words} words: a review page should synthesise, not reproduce; check it isn't a dump")
    if len(svgs) < 2:
        warns.append("only one diagram: check flows, branches and chains each have a visual")

    for f in fails:
        print("FAIL", f)
    for w in warns:
        print("WARN", w)
    print(f"{page.name}: {len(fails)} fail(s), {len(warns)} warning(s); {len(svgs)} svg, "
          f"{len(statuses)} status items ({', '.join(f'{s}={statuses.count(s)}' for s in STATUSES)})")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
