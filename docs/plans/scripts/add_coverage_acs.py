#!/usr/bin/env python3
"""7c repair: add one per-workflow coverage AC to each workflow's integration owner for the (requirement, WF) pairs no
AC proves yet (build_board.py gaps). One AC per (owner, WF) listing each obligation by id; inserted before the
ticket's final [regression/context] AC. Owner = the build-loop ticket listing the WF under "Entry points added or
changed", preferring kind integration, then the latest wave. Run after `build_board.py board`.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).parent))
import build_board as bb  # noqa: E402

T = ROOT / "docs/plans/tickets"
ASSIGN = {"WF-44": "NL-99", "WF-45": "NL-09"}   # workflows no ticket listed (7c decision)


def main():
    rows, gaps, _ = bb.compute()
    tickets, workflows, audit, reqs = bb.load()
    text = {bb.ca._plain(r["id"]).upper(): r["text"] for _, r in reqs if bb.ca._filled(r["id"])}
    meta = {p.stem: json.loads(p.read_text()) for p in T.glob("*.json") if not p.name.startswith("probe")}
    owners = {}
    for tid, m in meta.items():
        md = (T / f"{tid}.md").read_text()
        e = re.search(r"(?m)^- Entry points added or changed:\s*(.*)$", md)
        for wf in re.findall(r"WF-\d+", e.group(1) if e else ""):
            owners.setdefault(wf, []).append(tid)
    def pick(wf):
        if wf in ASSIGN:
            return ASSIGN[wf]
        c = [t for t in owners.get(wf, []) if meta[t]["lane"] == "build-loop"] or owners.get(wf, [])
        c.sort(key=lambda t: (meta[t]["kind"] == "integration", int(meta[t]["wave"])), reverse=True)
        return c[0] if c else None
    by = {}
    for rid, wf in gaps:
        o = pick(wf)
        if not o:
            print("NO OWNER", rid, wf)
            continue
        by.setdefault((o, wf), []).append(rid)
    for (o, wf), ids in sorted(by.items()):
        p = T / f"{o}.md"
        md = p.read_text()
        nums = [int(n) for n in re.findall(r"(?m)^- \[ \] AC-(\d+)", md)]
        k = max(nums) + 1
        parts = "; ".join(f"{i}: {re.sub(r'[|`*]', '', text.get(i, ''))[:80].rstrip()}" for i in ids)
        n = wf.split("-")[1]
        ac = (f"- [ ] AC-{k} [coverage] driving {wf}'s real entry point, each obligation below holds in that workflow — "
              f"{parts} — verify: `wf-{n}-obligations` test file in this ticket's owned test folder, one case per id, run "
              f"against the real stack — evidence: test output listing every id as passed — covers: {', '.join(ids)}")
        lines = md.split("\n")
        acl = [i for i, l in enumerate(lines) if re.match(r"^- \[ \] AC-\d+", l)]
        last = acl[-1]
        at = last if "regression/context" in lines[last] else last + 1
        lines.insert(at, ac)
        md = "\n".join(lines)
        if wf in ASSIGN and wf not in re.search(r"(?m)^- Entry points added or changed:.*$", md).group(0):
            md = re.sub(r"(?m)^- Entry points added or changed:\s*None\s*$", f"- Entry points added or changed: {wf}", md)
            md = re.sub(r"(?m)^(- Entry points added or changed: WF[^\n]*)$",
                        lambda m: m.group(1) if wf in m.group(1) else m.group(1) + f", {wf}", md)
            obs = re.search(r"(?ms)^### Observability\n(.*?)\n### ", md)
            body = obs.group(1)
            if body.strip().upper().startswith("N/A"):
                new = f"- Responsibilities: {wf} (its run's output files and their SHA-256, per DO-6)\n- Capture evidence: AC-{k}\n"
            else:
                new = re.sub(r"(?m)^(- Responsibilities: .*)$", lambda m: m.group(1) + f"; {wf} (per DO-6)", body)
                new = re.sub(r"(?m)^(- Capture evidence: .*)$", lambda m: m.group(1) + f" and AC-{k}", new) + "\n"
            md = md.replace(obs.group(0), "### Observability\n" + new.rstrip("\n") + "\n\n### ", 1)
            meta[o].setdefault("wfs", [])
            if wf not in meta[o]["wfs"]:
                meta[o]["wfs"].append(wf)
                (T / f"{o}.json").write_text(json.dumps(meta[o], ensure_ascii=False) + "\n")
        p.write_text(md)
        print(f"{o} AC-{k} {wf} covers {len(ids)}")


if __name__ == "__main__":
    main()
