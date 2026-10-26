# Resume checkpoint

Updated 2026-10-26 (VPS, Phase B, Sonnet). Replace at each handoff; history in the [dev log](../../docs/devlog/README.md).

- **Where:** §8 Build: every ticket that can run without Innocent is merged and pushed (main 68951d9 plus a ledger commit). Gate green (510 test files). NL-126 QA findings F-1..F-18 fixed and closed; NL-127 follow-up F-A/F-B merged.
- **Blocked on Innocent (nothing else is ready):** NL-02 (confirm Anthropic limit >= $75; keys are set and probed 200/200), then the `gate::paid` runs NL-109 and NL-112 (his yes to spend), then NL-120, 122-124, 128-130, 132, 134, 135, 137-143; NL-133 sign-off; NL-138 recording; NL-143 submit.
- **Open decisions:** M-24 stored p95 6.0 s vs 3 s (debounce 2.5 s + rerun / relax to 5 s / accept; recommended: lower and rerun); NL-102/NL-117 look-sheet comparisons and NL-103 screenshots need his eyes.
- **Before the final deploy gate:** one clean Compose run to test `Dockerfile.node` (/app/.demo) and the `seed` profile; follow-ups in `docs/plans/seam-followups.md` (S-103, S-G1-1, S-45..49).

