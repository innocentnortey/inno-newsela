"""Run ON THE VPS from the repo root; prints one JSON snapshot of the ticket state to stdout.

    ssh claude-vultr 'cd /home/linuxuser/workspaces/inno-newsela && python3 -' < export_snapshot.py > snapshot.json

Reads the ticket records (docs/plans/tickets/*.json + .md), docs/plans/merged.txt, the story, screen and metric
names, Phase B's commits, and every GitLab issue's state (glab, project 2346). No model calls."""
import glob, json, pathlib, re, subprocess

def names(path, pat):
    out = {}
    try:
        for line in open(path):
            m = re.match(pat, line)
            if m:
                out[m.group(1)] = m.group(2).strip()[:140]
    except FileNotFoundError:
        pass
    return out

tickets = []
for f in sorted(glob.glob("docs/plans/tickets/*.json")):
    if "probe" in f:
        continue
    t = json.load(open(f))
    md = pathlib.Path(f).with_suffix(".md")
    txt = md.read_text() if md.exists() else ""
    m = re.search(r"(?is)#+\s*(user )?story[^\n]*\n+(.+?)\n\s*\n", txt)
    t["story_text"] = (m.group(2).strip() if m else "")[:500]
    tickets.append(t)
issues, page = [], 1
while page < 6:
    r = subprocess.run(["glab", "api", f"projects/2346/issues?state=all&per_page=100&page={page}"], capture_output=True, text=True)
    batch = json.loads(r.stdout or "[]")
    if not batch:
        break
    issues += [{"iid": i["iid"], "state": i["state"], "labels": i["labels"], "closed_at": i.get("closed_at")} for i in batch]
    page += 1
git = lambda *a: subprocess.run(["git", *a], capture_output=True, text=True).stdout.strip()
print(json.dumps({
    "tickets": tickets, "issues": issues,
    "merged": [l.strip() for l in open("docs/plans/merged.txt") if l.strip()],
    "us": names("docs/ux/01-planning/USER_STORIES.md", r"^#+\s*(US-\d+)\s*[:·—-]+\s*(.+)"),
    "scr": names("docs/ux/03-structure/SCREEN_SPECS.md", r"^#+\s*(SCR-\d+)\s*[:·—-]+\s*(.+)"),
    "metrics": names("docs/design/metrics-registry.md", r"^\|\s*(M-\d+)\s*\|\s*([^|]+)\|"),
    "head": git("log", "-1", "--format=%h %cI"),
    "recent": git("log", "-12", "--format=%h %cI %s").splitlines(),
}))
