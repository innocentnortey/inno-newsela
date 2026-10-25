"""Set one ticket's clause in an area-map row's Status cell, replacing an earlier clause for the same ticket.

Usage: python3 scripts/area-map-status.py "<Area cell text>" "NL-71 built `src/...`"
Used at batch merge: on an area-map conflict take main's file (`git checkout --ours`), then run this once per merged ticket.
Clauses are separated by "; " and each starts with the ticket id; never paste the old cell back (maintenance rule §2).
"""
import re
import sys

PATH = ".claude/reference/area-map.md"


def main(area: str, clause: str) -> None:
    ticket = clause.split()[0]
    lines = open(PATH).read().split("\n")
    hits = [i for i, l in enumerate(lines) if l.startswith("| ") and l.split(" | ")[1:2] and l.split(" | ")[1].strip() == area]
    assert len(hits) == 1, f"{len(hits)} rows named {area!r}"
    cells = lines[hits[0]].split(" | ")
    status = cells[-1][:-2] if cells[-1].endswith(" |") else cells[-1]
    own = re.compile(rf"(?<![^\s;.]){re.escape(ticket)} built .*?(?=[;.] (?:NL|S)-\d+ |\. [A-Z]|$)")
    status = own.sub("", status).replace(";  ", "; ").replace(". .", ".").strip("; ") if own.search(status) else status
    cells[-1] = f"{status}; {clause} |" if status else f"{clause} |"
    lines[hits[0]] = " | ".join(cells)
    open(PATH, "w").write("\n".join(lines))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
