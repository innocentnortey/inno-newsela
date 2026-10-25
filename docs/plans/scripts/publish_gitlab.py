#!/usr/bin/env python3
"""Publish every ticket in docs/plans/tickets/ as a GitLab issue (project 2346) and record its iid.

    python3 docs/plans/scripts/publish_gitlab.py [--dry-run] [--update]

Idempotent: an issue whose title starts with "[<ID>]" is reused (its iid recorded), never duplicated; --update
rewrites existing issues' descriptions and labels from the current .md/.json. Creates missing labels first. Uses
`glab api` (HTTPS; glab's stored login), so no token is read or printed here. Issues are created in wave order so
blocker references in bodies already exist. Labels: wave::N, kind::<kind>, lane::<lane>, slice::<area>,
risk::security, gate::human (human lane), cuttable.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TICKETS = ROOT / "docs/plans/tickets"
HOST, PID = "labs.gauntletai.com", 2346
COLORS = {"wave": "#428BCA", "kind": "#5CB85C", "lane": "#F0AD4E", "slice": "#8E44AD", "risk": "#D9534F",
          "gate": "#D10069", "cuttable": "#7F8C8D"}


def api(path, method="GET", body=None):
    cmd = ["glab", "api", path, "--hostname", HOST, "--method", method]
    tmp = None
    if body is not None:
        tmp = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
        json.dump(body, tmp)
        tmp.close()
        cmd += ["--input", tmp.name, "-H", "Content-Type: application/json"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if tmp:
        Path(tmp.name).unlink()
    if r.returncode != 0:
        raise SystemExit(f"glab api {method} {path} failed: {(r.stdout + r.stderr)[:300]}")
    return json.loads(r.stdout) if r.stdout.strip() else None


def paged(path):
    out, page = [], 1
    while True:
        sep = "&" if "?" in path else "?"
        batch = api(f"{path}{sep}per_page=100&page={page}")
        if not batch:
            return out
        out += batch
        page += 1


def labels_for(t):
    ls = [f"wave::{t['wave']}", f"kind::{t['kind']}", f"lane::{t['lane']}"]
    if t.get("area"):
        ls.append(f"slice::{t['area']}")
    if t.get("risk_security"):
        ls.append("risk::security")
    if t["lane"] == "human":
        ls.append("gate::human")
    if t.get("cuttable"):
        ls.append("cuttable")
    return ls


def order_key(t):
    m = re.match(r"([A-Z]+)-(\d+)", t["id"])
    return (int(t["wave"]), 0 if m.group(1) == "FW" else 1, int(m.group(2)))


def main():
    dry, update = "--dry-run" in sys.argv, "--update" in sys.argv
    recs = []
    for p in TICKETS.glob("*.json"):
        if p.name.startswith("probe"):
            continue
        t = json.loads(p.read_text())
        t["_path"] = p
        recs.append(t)
    recs.sort(key=order_key)
    wanted = sorted({l for t in recs for l in labels_for(t)})
    have = {l["name"] for l in paged(f"projects/{PID}/labels")} if not dry else set()
    for name in wanted:
        if name not in have:
            print("label +", name)
            if not dry:
                api(f"projects/{PID}/labels", "POST", {"name": name, "color": COLORS[name.split("::")[0]]})
    existing = {}
    if not dry:
        for i in paged(f"projects/{PID}/issues?state=all"):
            m = re.match(r"\[([A-Z]+-\d+)\]", i["title"])
            if m:
                existing[m.group(1)] = i["iid"]
    for t in recs:
        md = (TICKETS / f"{t['id']}.md").read_text()
        lines = md.split("\n")
        if lines and lines[0].startswith("## ["):
            lines = lines[1:]
        body = {"title": f"[{t['id']}] {t['title']}", "description": "\n".join(lines).strip(),
                "labels": ",".join(labels_for(t))}
        iid = existing.get(t["id"])
        if dry:
            print("would publish", body["title"], body["labels"])
            continue
        if iid and update:
            api(f"projects/{PID}/issues/{iid}", "PUT", body)
            print("updated", t["id"], iid)
        elif not iid:
            iid = api(f"projects/{PID}/issues", "POST", body)["iid"]
            print("created", t["id"], iid)
        if t.get("gitlab_iid") != iid:
            t["gitlab_iid"] = iid
            p = t.pop("_path")
            p.write_text(json.dumps({k: v for k, v in t.items()}, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
