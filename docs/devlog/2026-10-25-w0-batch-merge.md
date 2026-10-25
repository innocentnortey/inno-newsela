# Wave 0 batch merge (Phase B, Sonnet)

**Changed.** Merged NL-01 then FW-1 (`--no-ff`); NL-04/NL-05 landed directly. Root lockfile regenerated to include `apps/web`. Next bumped 16.4.0 → 16.4.3 (critical RCE advisory; departs from the 14-day-old rule; PD-32). Adopted workflow release R-3 (evidence-only edit to planning-context-packs); rollback: `git revert` the adoption commit / see `ops/vps-run/adopted.json`.
**Why.** Wave 0 gates the rest. **Checked.** Root: lint, typecheck, 111 tests green; apps/web 131 tests green; frozen-test hashes match; code review PASS both; security review of NL-01: no blocking finding.
**Remaining.** Security follow-ups: replace `xlsx` 0.18.5 before NL-16 merges (CVE-2023-30533, CVE-2024-22363); logger key-name redaction; min length 32 for AUDIT_HASH_SALT / COLLAB_INTERNAL_TOKEN. NL-02/NL-03 are Innocent's.
