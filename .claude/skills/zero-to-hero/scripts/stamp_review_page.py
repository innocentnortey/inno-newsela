"""Stamp a visual review page with its sources' current SHA-256 and the review date.

Usage:
  python3 scripts/stamp_review_page.py <page.html> [--root <project-root>] [--date YYYY-MM-DD]

Run this ONLY after you have updated the page's content from the changed sources. Stamping a page
whose content you didn't refresh hides staleness instead of fixing it.

It rewrites every <meta name="review-source" content="path|…"> with the file's current hash,
every element carrying data-sha-for="path" with the first 12 hex characters, and
<meta name="review-date">. Then run check_review_page.py.
"""

import argparse
import datetime
import hashlib
import re
from pathlib import Path


def find_root(page: Path) -> Path:
    for p in [page.parent, *page.parents]:
        if (p / "PROJECT-CHECKLIST.md").exists():
            return p
    return page.parent


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("page")
    ap.add_argument("--root")
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    a = ap.parse_args()
    page = Path(a.page).resolve()
    root = Path(a.root).resolve() if a.root else find_root(page)
    doc = page.read_text()

    def digest(path: str) -> str:
        return hashlib.sha256((root / path).read_bytes()).hexdigest()

    doc = re.sub(r'<meta name="review-source" content="([^"|]+)\|[^"]*">',
                 lambda m: f'<meta name="review-source" content="{m.group(1)}|{digest(m.group(1))}">', doc)
    doc = re.sub(r'(<[^>]*\bdata-sha-for="([^"]+)"[^>]*>)[^<]*(<)',
                 lambda m: f"{m.group(1)}{digest(m.group(2))[:12]}{m.group(3)}", doc)
    doc = re.sub(r'<meta name="review-date" content="[^"]*">', f'<meta name="review-date" content="{a.date}">', doc)
    page.write_text(doc)
    print(f"stamped {page.name}: {len(re.findall('review-source', doc))} source(s), date {a.date}")


if __name__ == "__main__":
    main()
