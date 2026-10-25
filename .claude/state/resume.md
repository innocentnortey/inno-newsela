# Resume checkpoint

Updated 2026-10-25 (Mac session, at the VPS handoff). Replace this file's content at each handoff; history goes in the
[dev log](../../docs/devlog/README.md).

- **Where the work is:** the **VPS copy is authoritative** (`claude-vultr:/home/linuxuser/workspaces/inno-newsela`,
  PD-34). It is run by the two-phase launcher in [`ops/vps-run/`](../../ops/vps-run/README.md). The Mac copy is a snapshot
  of 2026-10-25 and is not worked on.
- **Where the project is:** zero-to-hero 2.0.0. §0–§4 done; UX-1 done (Claude-closed); UX-2 done (**D1 Clear Ledger**);
  UX-3a: 24 CON cards `proposed`, UX reviews done, every UXP/UXQ decided (PD-31), **System review pending**; UX-3b: IA,
  21 screen specs, `design.md` tokens, wave 1 signed; FW-1…FW-4 ready (not built); §5 and §6 not started; capacity
  decided (PD-33: 500 users/day, spike of 200 concurrent users, no 200-day requirement).
- **Next action:** Phase A (Opus) — `bash ops/vps-run/run.sh` on the VPS starts it; its prompt is
  `ops/vps-run/prompts/phase-a-opus.md`.
- **Standing authorization:** PD-32 (Claude's recommendations adopted through the remaining stages; human-only evidence
  stays labelled as such).
- **Data boundary:** `docs/source/restricted/` is git-ignored; never quote it into tracked docs, prompts or issues.
