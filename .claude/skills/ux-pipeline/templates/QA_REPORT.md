# UX-5 · QA report

> Date: YYYY-MM-DD · Outcomes: PASS · FAIL · NOT_RUN · NEEDS_HUMAN_REVIEW
> UX-5a runs per frontend slice during §8 (against the Prism mock). UX-5b is the final acceptance against the
> connected application (Prism proxy in front of the real backend) and a human walkthrough, before §9/§10.

## UX-5a · Verification during implementation (one block per slice)
### Slice <ticket ID> · Build: <commit> · Mock: `docs/contracts/interface.openapi.yaml` @ <commit>
| Test | Covers | Kind | Outcome | Evidence |
|---|---|---|---|---|
| TEST-1 | SCR-N / FLOW-N / CON-N | traceability / flow / axe / visual / contract | | <file, screenshot> |

## UX-5b · Final acceptance (connected application)
> Build: <commit> · Backend: <url> · Proxy: `prism proxy docs/contracts/interface.openapi.yaml <url> --errors`

| Test | Covers | Kind | Outcome | Evidence |
|---|---|---|---|---|
| TEST-N | | flow / axe / visual / contract / Lighthouse | | |

### Human walkthrough (only what someone actually did)
| Task | Who | Date | Completed? | Observed difficulty | Goes back to |
|---|---|---|---|---|---|

## Failures routed back
| Finding | Owning phase | Artifact changed | CHG-N / reconcile marks | Gates reopened |
|---|---|---|---|---|
